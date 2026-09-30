#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statfsSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const overlayRoot = path.resolve(here, "..");
const canonicalPaths = [
  "/home/ubuntu/bb",
  "/home/ubuntu/.bb",
  "/home/ubuntu/.local/share/pnpm",
];
const minFreeBytes = 20_000_000_000n;
const minFreeInodes = 250_000n;

function fail(message) {
  throw new Error(`environment Git qualification refused: ${message}`);
}

export function isInside(parent, candidate) {
  return candidate === parent || candidate.startsWith(`${parent}${path.sep}`);
}

export function assertCapacity(stats, label) {
  const freeBytes = BigInt(stats.bsize) * BigInt(stats.bavail);
  const freeInodes = BigInt(stats.ffree);
  if (freeBytes < minFreeBytes || freeInodes < minFreeInodes) {
    fail(`${label} has ${freeBytes} free bytes and ${freeInodes} free inodes`);
  }
  return { freeBytes: String(freeBytes), freeInodes: String(freeInodes) };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function hashFile(file) {
  return sha256(readFileSync(file));
}

function git(cwd, ...args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_NO_REPLACE_OBJECTS: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function requireCanonicalAbsent() {
  for (const candidate of canonicalPaths) {
    if (existsSync(candidate)) fail(`canonical host path is visible: ${candidate}`);
    try {
      lstatSync(candidate);
      fail(`canonical host path is visible: ${candidate}`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}

function context() {
  if (process.env.GITHUB_ACTIONS !== "true") fail("not a GitHub Actions runner");
  if (process.env.RUNNER_OS !== "Linux") fail("runner is not Linux");
  const workspace = realpathSync(process.env.GITHUB_WORKSPACE ?? "");
  const runnerTemp = realpathSync(process.env.RUNNER_TEMP ?? "");
  const expectedRoot = path.join(
    runnerTemp,
    `environment-git-qualification-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`,
  );
  const root = path.resolve(process.env.BB_ENV_GIT_QUAL_ROOT ?? "");
  if (root !== expectedRoot) fail("qualification root differs from run identity");
  if (workspace !== realpathSync(overlayRoot)) fail("workflow source is not checkout root");
  if (!isInside(runnerTemp, root) || isInside(workspace, root)) {
    fail("qualification root is not private runner temp");
  }
  if (workspace !== realpathSync(process.cwd())) fail("wrong working directory");
  requireCanonicalAbsent();
  return { workspace, runnerTemp, root };
}

function writeReceipt(root, name, value) {
  const file = path.join(root, name);
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  console.log(`${name} sha256 ${hashFile(file)}`);
}

function readReceipt(root, name) {
  const file = path.join(root, name);
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) {
    fail(`receipt is not a private regular file: ${name}`);
  }
  return JSON.parse(readFileSync(file, "utf8"));
}

function assertSourceIdentity(workspace) {
  const sourceCommit = git(workspace, "rev-parse", "HEAD");
  const expected = process.env.BB_ENV_GIT_SOURCE_SHA ?? "";
  if (!/^[0-9a-f]{40}$/.test(expected) || sourceCommit !== expected) {
    fail("checkout does not match the exact requested source commit");
  }
  if (git(workspace, "status", "--porcelain") !== "") {
    fail("source checkout is dirty before materialization");
  }
  return {
    commit: sourceCommit,
    tree: git(workspace, "rev-parse", "HEAD^{tree}"),
    upstream: readFileSync(path.join(workspace, "upstream.lock"), "utf8").trim(),
    resultTree: readFileSync(path.join(workspace, "result-tree.lock"), "utf8").trim(),
    hashes: Object.fromEntries(
      [
        "upstream.lock",
        "result-tree.lock",
        "patches/series",
        "patches/sha256",
        ".github/workflows/validate.yml",
        "scripts/check-environment-git-qualification.mjs",
        "scripts/check-environment-git-qualification.test.mjs",
      ].map((name) => [name, hashFile(path.join(workspace, name))]),
    ),
  };
}

function assertOverlayInputUnchanged(workspace, preflightSource) {
  const current = assertSourceIdentity(workspace);
  if (JSON.stringify(current) !== JSON.stringify(preflightSource)) {
    fail("overlay source or qualification inputs changed after preflight");
  }
}

function assertPrivatePaths(root) {
  for (const name of ["store", "cache", "tmp", "home", "out"]) {
    const candidate = path.join(root, name);
    if (!isInside(root, realpathSync(candidate))) {
      fail(`${name} escapes qualification root`);
    }
  }
  const expected = {
    TMPDIR: path.join(root, "tmp"),
    XDG_CACHE_HOME: path.join(root, "cache"),
    npm_config_cache: path.join(root, "cache", "npm"),
    npm_config_store_dir: path.join(root, "store"),
    HOME: path.join(root, "home"),
  };
  for (const [key, value] of Object.entries(expected)) {
    if (process.env[key] !== value) fail(`${key} is outside the private root`);
  }
}

export function assertNoExternalSymlinks(source, root) {
  const stack = [source, root];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === ".git") continue;
      const candidate = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(candidate);
      } else if (entry.isSymbolicLink()) {
        const target = realpathSync(candidate);
        if (!isInside(source, target) && !isInside(root, target)) {
          fail(`dependency symlink escapes private source/store: ${candidate}`);
        }
      }
    }
  }
}

function assertMaterializedTrackedClean(bb) {
  if (git(bb, "status", "--porcelain", "--untracked-files=no") !== "") {
    fail("materialized tracked source changed during qualification");
  }
}

function preflight() {
  const { workspace, runnerTemp, root } = context();
  if (existsSync(root)) fail("qualification root already exists");
  if (existsSync(path.join(workspace, "build", "bb"))) {
    fail("materialization already exists before preflight");
  }
  const capacity = {
    workspace: assertCapacity(statfsSync(workspace, { bigint: true }), "workspace"),
    runnerTemp: assertCapacity(statfsSync(runnerTemp, { bigint: true }), "runner temp"),
  };
  const source = assertSourceIdentity(workspace);
  mkdirSync(root, { mode: 0o700 });
  for (const name of ["store", "cache", "tmp", "home", "out"]) {
    mkdirSync(path.join(root, name), { mode: 0o700 });
  }
  mkdirSync(path.join(root, "cache", "npm"), { mode: 0o700 });
  assertPrivatePaths(root);
  writeReceipt(root, "preflight.json", {
    schema: "bb-environment-git-qualification-preflight-v1",
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    runner: { os: process.env.RUNNER_OS, name: process.env.RUNNER_NAME },
    source,
    paths: { workspace, runnerTemp, root },
    capacity,
    canonicalPathsAbsent: canonicalPaths,
  });
}

function source() {
  const { workspace, root } = context();
  assertPrivatePaths(root);
  const pre = readReceipt(root, "preflight.json");
  if (pre.source.commit !== process.env.BB_ENV_GIT_SOURCE_SHA) {
    fail("preflight source changed");
  }
  assertOverlayInputUnchanged(workspace, pre.source);
  const bb = realpathSync(path.join(workspace, "build", "bb"));
  if (!isInside(workspace, bb)) fail("materialized source escapes checkout");
  const upstream = git(path.join(workspace, "upstream"), "rev-parse", "HEAD");
  const tree = git(bb, "rev-parse", "HEAD^{tree}");
  if (upstream !== pre.source.upstream || tree !== pre.source.resultTree) {
    fail("materialized source differs from locked overlay");
  }
  assertMaterializedTrackedClean(bb);
  if (existsSync(path.join(bb, "node_modules"))) {
    fail("materialized source already links dependencies");
  }
  const sdkPackage = JSON.parse(
    readFileSync(path.join(bb, "packages/plugin-sdk/package.json"), "utf8"),
  );
  const domainVersion = readFileSync(
    path.join(bb, "packages/domain/src/plugin-sdk-version.ts"),
    "utf8",
  );
  const protocol = readFileSync(
    path.join(bb, "packages/host-daemon-contract/src/protocol.ts"),
    "utf8",
  );
  if (!domainVersion.includes(`PLUGIN_SDK_VERSION = "${sdkPackage.version}"`)) {
    fail("SDK package/domain versions disagree");
  }
  if (!protocol.includes("HOST_DAEMON_PROTOCOL_VERSION = 220")) {
    fail("host protocol is not 220");
  }
  if (!readFileSync(path.join(bb, "packages/plugin-sdk/src/backend-contract.ts"), "utf8")
    .includes("experimental_environmentGitObjects")) {
    fail("public inspection API is absent");
  }
  const hashes = Object.fromEntries(
    [
      "pnpm-lock.yaml",
      "package.json",
      "packages/plugin-sdk/package.json",
      "packages/domain/src/plugin-sdk-version.ts",
      "packages/host-daemon-contract/src/protocol.ts",
    ].map((name) => [name, hashFile(path.join(bb, name))]),
  );
  writeReceipt(root, "source.json", {
    schema: "bb-environment-git-qualification-source-v1",
    overlayCommit: pre.source.commit,
    overlayTree: pre.source.tree,
    upstream,
    materializedCommit: git(bb, "rev-parse", "HEAD"),
    materializedTree: tree,
    sdkVersion: sdkPackage.version,
    hostProtocol: 220,
    hashes,
  });
}

function postinstall() {
  const { workspace, root } = context();
  assertPrivatePaths(root);
  assertOverlayInputUnchanged(workspace, readReceipt(root, "preflight.json").source);
  const before = readReceipt(root, "source.json");
  const bb = realpathSync(path.join(workspace, "build", "bb"));
  const nodeModules = path.join(bb, "node_modules");
  if (!statSync(nodeModules).isDirectory() || lstatSync(nodeModules).isSymbolicLink()) {
    fail("installed root node_modules is not a private directory");
  }
  if (git(bb, "rev-parse", "HEAD^{tree}") !== before.materializedTree) {
    fail("materialized Git tree changed during install");
  }
  assertMaterializedTrackedClean(bb);
  for (const [name, expected] of Object.entries(before.hashes)) {
    if (hashFile(path.join(bb, name)) !== expected) {
      fail(`frozen input changed during install: ${name}`);
    }
  }
  assertNoExternalSymlinks(bb, root);
  requireCanonicalAbsent();
  writeReceipt(root, "postinstall.json", {
    schema: "bb-environment-git-qualification-postinstall-v1",
    materializedTree: before.materializedTree,
    lockSha256: before.hashes["pnpm-lock.yaml"],
    nodeModules: realpathSync(nodeModules),
    privateStore: realpathSync(path.join(root, "store")),
    privateCache: realpathSync(path.join(root, "cache")),
    privateTmp: realpathSync(path.join(root, "tmp")),
    canonicalPathsAbsent: canonicalPaths,
  });
}

function artifact() {
  const { workspace, root } = context();
  assertPrivatePaths(root);
  assertOverlayInputUnchanged(workspace, readReceipt(root, "preflight.json").source);
  const before = readReceipt(root, "source.json");
  readReceipt(root, "postinstall.json");
  const bb = realpathSync(path.join(workspace, "build", "bb"));
  if (git(bb, "rev-parse", "HEAD^{tree}") !== before.materializedTree) {
    fail("materialized tree drifted after package build");
  }
  assertMaterializedTrackedClean(bb);
  for (const [name, expected] of Object.entries(before.hashes)) {
    if (hashFile(path.join(bb, name)) !== expected) {
      fail(`frozen input changed during package build: ${name}`);
    }
  }
  assertNoExternalSymlinks(bb, root);
  const out = path.join(root, "out");
  const tarballs = readdirSync(out).filter((name) => name.endsWith(".tgz"));
  if (tarballs.length !== 1) fail("expected exactly one SDK tarball");
  const tarball = path.join(out, tarballs[0]);
  if (!lstatSync(tarball).isFile()) fail("SDK artifact is not a regular file");
  const entries = execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" });
  if (!entries.split("\n").includes("package/bundled-types/bb-plugin-sdk.d.ts")) {
    fail("SDK artifact lacks its public declaration");
  }
  const declaration = execFileSync(
    "tar",
    ["-xOzf", tarball, "package/bundled-types/bb-plugin-sdk.d.ts"],
  );
  if (!declaration.toString("utf8").includes("experimental_environmentGitObjects")) {
    fail("SDK artifact lacks the inspection API");
  }
  const packedManifest = execFileSync(
    "tar",
    ["-xOzf", tarball, "package/package.json"],
  );
  const manifest = JSON.parse(packedManifest.toString("utf8"));
  if (manifest.version !== before.sdkVersion) fail("SDK artifact version drifted");
  requireCanonicalAbsent();
  writeReceipt(root, "artifact.json", {
    schema: "bb-environment-git-qualification-artifact-v1",
    overlayCommit: before.overlayCommit,
    materializedCommit: before.materializedCommit,
    materializedTree: before.materializedTree,
    lockSha256: before.hashes["pnpm-lock.yaml"],
    sdkVersion: before.sdkVersion,
    hostProtocol: before.hostProtocol,
    tarball: tarballs[0],
    tarballSha256: hashFile(tarball),
    manifestSha256: sha256(packedManifest),
    declarationSha256: sha256(declaration),
    canonicalPathsAbsent: canonicalPaths,
  });
}

const phases = { preflight, source, postinstall, artifact };
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const phase = process.argv[2];
  if (!Object.hasOwn(phases, phase)) fail("unknown qualification phase");
  phases[phase]();
}
