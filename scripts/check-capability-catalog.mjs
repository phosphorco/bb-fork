#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const catalogKeys = ["schemaVersion", "reviewedUpstream", "reviewedResultTree", "capabilities"];
const capabilityKeys = [
  "id",
  "title",
  "motivation",
  "behavior",
  "owners",
  "patches",
  "sourceDigest",
  "surfaces",
  "verification",
  "retirement",
  "limitations",
];
const surfaceKeys = ["kind", "paths", "summary", "why", "symbols", "visibility"];
const surfaceKinds = new Set([
  "database",
  "api",
  "runtime",
  "verification",
  "generated",
  "documentation",
  "dependency",
]);
const apiRoots = [
  "packages/plugin-sdk/src/",
  "packages/sdk/src/",
  "packages/server-contract/src/",
  "packages/domain/src/",
  "packages/provider-bridge-protocol/src/",
  "packages/host-daemon-contract/src/",
  "apps/server/src/routes/",
];
const publicEntrypoints = new Set(["packages/client-core/src/index.ts"]);
const privateApis = new Set(
  ["identity-protocol.ts", "provider-contract.ts", "provider-admission.ts"].map(
    (name) => `apps/server/src/services/p6r/${name}`,
  ),
);
const sidecarDatabase = new Set(
  ["sidecar-schema.ts", "sidecar-migrate.ts", "sidecar-store.ts"].map(
    (name) => `apps/server/src/services/p6r/${name}`,
  ),
);

function refuse(message) {
  throw new Error(`Capability catalog: ${message}`);
}

function record(value, allowed, required, label) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    refuse(`${label} must be an object`);
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) refuse(`${label} has unknown field ${key}`);
  for (const key of required) if (!Object.hasOwn(value, key)) refuse(`${label} is missing ${key}`);
}

function text(value, label) {
  if (typeof value !== "string" || !value.trim()) refuse(`${label} must be a nonempty string`);
  if (/\b(?:TODO|TBD|FIXME)\b/u.test(value)) refuse(`${label} contains an unfinished placeholder`);
  return value;
}

function stringArray(value, label, allowEmpty = false) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0))
    refuse(`${label} must be ${allowEmpty ? "an" : "a nonempty"} array`);
  const seen = new Set();
  for (const item of value) {
    text(item, label);
    if (seen.has(item)) refuse(`${label} repeats ${item}`);
    seen.add(item);
  }
  return value;
}

function sourcePath(value, label) {
  text(value, label);
  if (
    value.startsWith("/") ||
    /[\\\u0000-\u001f\u007f\ufffd]/u.test(value) ||
    value.split("/").some((part) => !part || part === "." || part === "..")
  )
    refuse(`${label} has unsafe source path ${JSON.stringify(value)}`);
  return value;
}

function patchName(value, label) {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9_.-]*\.patch$/u.test(value) ||
    value.includes("..")
  )
    refuse(`${label} has unsafe patch filename ${JSON.stringify(value)}`);
  return value;
}

function readOwnedFile(path) {
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    refuse(`missing file ${path}`);
  }
  if (!stat.isFile() || stat.isSymbolicLink())
    refuse(`expected a regular nonsymlink file: ${path}`);
  return readFileSync(path);
}

function git(root, args) {
  try {
    return execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    refuse(
      `git ${args[0]} failed in ${root}: ${String(error.stderr || error.message).split("\n")[0]}`,
    );
  }
}

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function decodeGitPath(value) {
  if (!value.startsWith('"')) return value;
  if (!value.endsWith('"')) refuse("unterminated quoted rename path");
  const bytes = [];
  const escapes = { a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13, "\\": 92, '"': 34 };
  for (let index = 1; index < value.length - 1; index += 1) {
    if (value[index] !== "\\") {
      const codepoint = value.codePointAt(index);
      bytes.push(...Buffer.from(String.fromCodePoint(codepoint)));
      if (codepoint > 0xffff) index += 1;
      continue;
    }
    index += 1;
    const octal = value.slice(index, -1).match(/^[0-7]{1,3}/u)?.[0];
    if (octal) {
      bytes.push(Number.parseInt(octal, 8));
      index += octal.length - 1;
    } else if (Object.hasOwn(escapes, value[index])) {
      bytes.push(escapes[value[index]]);
    } else {
      refuse("unsupported quoted rename path escape");
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
  } catch {
    refuse("rename path is not valid UTF-8");
  }
}

export function patchTouchedPaths(root, name) {
  const patch = join(root, "patches", name);
  let result;
  try {
    result = execFileSync("git", ["apply", "--numstat", "-z", "--", patch], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    refuse(`cannot parse ${name}: ${String(error.stderr || error.message).split("\n")[0]}`);
  }
  const paths = new Set();
  for (const row of result.split("\0").filter(Boolean)) {
    const match = row.match(/^(?:\d+|-)\t(?:\d+|-)\t([\s\S]+)$/u);
    if (!match) refuse(`unsupported numstat record in ${name}`);
    paths.add(sourcePath(match[1], name));
  }
  for (const line of readOwnedFile(patch).toString("utf8").split("\n")) {
    const match = line.match(/^(?:rename|copy) from (.+)$/u);
    if (match) paths.add(sourcePath(decodeGitPath(match[1]), name));
  }
  if (paths.size === 0) refuse(`${name} contains no changed paths`);
  return paths;
}

export function readQueue(root) {
  const series = [];
  const selected = new Set();
  for (const line of readOwnedFile(join(root, "patches/series")).toString("utf8").split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const name = patchName(line, "patches/series");
    if (selected.has(name)) refuse(`duplicate series entry ${name}`);
    selected.add(name);
    series.push(name);
  }
  const actual = readdirSync(join(root, "patches")).filter((name) => name.endsWith(".patch"));
  for (const name of actual)
    if (!selected.has(name))
      refuse(`unselected patch file ${name}; retire it or include and catalog it`);
  const checksums = new Map();
  for (const line of readOwnedFile(join(root, "patches/sha256")).toString("utf8").split("\n")) {
    if (!line.trim()) continue;
    const match = line.match(/^([a-f0-9]{64}) [ *](.+)$/u);
    if (!match) refuse("malformed patches/sha256 entry");
    const name = patchName(match[2], "patches/sha256");
    if (checksums.has(name)) refuse(`duplicate checksum entry ${name}`);
    if (!selected.has(name)) refuse(`orphan checksum entry ${name}`);
    checksums.set(name, match[1]);
  }
  const hashes = new Map();
  const paths = new Map();
  for (const name of series) {
    if (!checksums.has(name)) refuse(`missing checksum for ${name}`);
    const hash = sha256(readOwnedFile(join(root, "patches", name)));
    if (hash !== checksums.get(name)) refuse(`patch checksum mismatch for ${name}`);
    hashes.set(name, hash);
    paths.set(name, patchTouchedPaths(root, name));
  }
  return { series, hashes, paths };
}

export function computeSourceDigest(upstream, names, queue) {
  const primary = new Set(names);
  const touched = new Set(names.flatMap((name) => [...queue.paths.get(name)]));
  return sha256(
    JSON.stringify({
      upstream,
      patches: queue.series
        .filter(
          (name) =>
            primary.has(name) || [...queue.paths.get(name)].some((path) => touched.has(path)),
        )
        .map((name) => [name, queue.hashes.get(name)]),
    }),
  );
}

function isVerificationPath(path) {
  return (
    /(?:^|\/)(?:test|tests|contract-tests|__tests__|__fixtures__|fixtures)(?:\/|$)/u.test(path) ||
    /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(path)
  );
}

function isGeneratedDatabase(path) {
  return /^(?:packages\/db\/drizzle|apps\/server\/src\/services\/p6r\/drizzle)\/meta\/[^/]+\.json$/u.test(
    path,
  );
}

export function requiredSurfaceKind(path) {
  if (isVerificationPath(path)) return "verification";
  if (path.includes("/testing/")) return "testing-helper";
  if (isGeneratedDatabase(path)) return "generated";
  if (path.startsWith("packages/db/src/") || sidecarDatabase.has(path) || path.endsWith(".sql"))
    return "database";
  if (
    apiRoots.some((prefix) => path.startsWith(prefix)) ||
    publicEntrypoints.has(path) ||
    privateApis.has(path)
  )
    return "api";
  return null;
}

function validateCheckout(root, checkout, catalog, queue) {
  const selected = resolve(checkout);
  if (
    realpathSync(selected) !== realpathSync(git(selected, ["rev-parse", "--show-toplevel"]).trim())
  )
    refuse("--checkout must name the materialized Git root");
  if (git(selected, ["status", "--porcelain", "--untracked-files=all"]).trim())
    refuse(
      "materialized checkout has authored changes; preserve them and use a clean verified checkout",
    );
  if (git(selected, ["rev-parse", "HEAD^{tree}"]).trim() !== catalog.reviewedResultTree)
    refuse("checkout tree differs from reviewedResultTree/result-tree.lock");
  git(selected, ["merge-base", "--is-ancestor", catalog.reviewedUpstream, "HEAD"]);
  const changed = new Set(
    git(selected, [
      "diff",
      "--no-renames",
      "--name-only",
      "-z",
      catalog.reviewedUpstream,
      "HEAD",
      "--",
    ])
      .split("\0")
      .filter(Boolean)
      .map((path) => sourcePath(path, "net diff")),
  );
  const allCovered = new Set();
  for (const capability of catalog.capabilities) {
    const expected = new Set(
      capability.patches
        .flatMap((name) => [...queue.paths.get(name)])
        .filter((path) => changed.has(path)),
    );
    const declared = new Set(capability.surfaces.flatMap((surface) => surface.paths));
    for (const path of expected)
      if (!declared.has(path))
        refuse(`${capability.id} has uncataloged changed source path ${path}`);
    for (const path of declared)
      if (!expected.has(path))
        refuse(`${capability.id} declares path outside its current net footprint: ${path}`);
    for (const surface of capability.surfaces)
      for (const path of surface.paths) {
        const required = requiredSurfaceKind(path);
        if (required === "testing-helper") {
          if (
            surface.kind !== "verification" &&
            !(surface.kind === "api" && surface.visibility === "internal")
          )
            refuse(
              `${capability.id}: ${path} requires verification or internal API classification`,
            );
        } else if (required && surface.kind !== required) {
          refuse(
            `${capability.id}: ${path} requires ${required} classification, found ${surface.kind}`,
          );
        }
        if (privateApis.has(path) && surface.visibility === "public")
          refuse(
            `${capability.id}: ${path} is a private/internal implementation contract, not a public API`,
          );
        allCovered.add(path);
      }
  }
  for (const path of changed)
    if (!allCovered.has(path)) refuse(`net source path has no capability owner: ${path}`);
}

function inlineCode(value) {
  const runs = value.match(/`+/gu) ?? [];
  const marker = "`".repeat(Math.max(0, ...runs.map((run) => run.length)) + 1);
  return `${marker}${value}${marker}`;
}

function tableText(value) {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function renderSurfaces(lines, heading, surfaces) {
  if (!surfaces.length) return;
  lines.push(`### ${heading}`, "");
  for (const surface of surfaces) {
    lines.push(`- **${surface.summary}**`, `  - Why: ${surface.why}`);
    if (surface.visibility) lines.push(`  - Visibility: ${surface.visibility}`);
    if (surface.symbols?.length)
      lines.push(`  - State/API identities: ${surface.symbols.map(inlineCode).join(", ")}`);
    lines.push(`  - Source: ${surface.paths.map(inlineCode).join(", ")}`);
  }
  lines.push("");
}

export function renderCatalog(catalog) {
  const totalPatches = catalog.capabilities.reduce(
    (sum, capability) => sum + capability.patches.length,
    0,
  );
  const lines = [
    "# Current downstream capabilities",
    "",
    "<!-- Generated from capabilities.json by scripts/check-capability-catalog.mjs. Do not edit by hand. -->",
    "",
    `This is the selected source delta: **${catalog.capabilities.length} capabilities / ${totalPatches} patches**. It is not a deployment or live-test receipt.`,
    "",
    `- Reviewed upstream: ${inlineCode(catalog.reviewedUpstream)}`,
    `- Reviewed result tree: ${inlineCode(catalog.reviewedResultTree)}`,
    "",
    "The checker enforces explicit source coverage and review freshness. Each capability digest binds its primary patches and all selected patches touching the same source files, requiring shared-source dependency review. Human review establishes whether explanations and state/API identities are semantically complete. Historical notes remain in [DOWNSTREAM.md](DOWNSTREAM.md).",
    "",
    "| Capability | Motivation | Patches |",
    "| --- | --- | --- |",
  ];
  for (const capability of catalog.capabilities)
    lines.push(
      `| [${tableText(capability.title)}](#${capability.id}) | ${tableText(capability.motivation)} | ${capability.patches.length} |`,
    );
  if (!catalog.capabilities.length) lines.push("| None | No selected downstream patches. | 0 |");
  lines.push("");
  for (const capability of catalog.capabilities) {
    lines.push(
      `<a id="${capability.id}"></a>`,
      `## ${capability.title}`,
      "",
      capability.motivation,
      "",
      "### What this delivers",
      "",
      ...capability.behavior.map((item) => `- ${item}`),
      "",
      "### Responsibility",
      "",
      ...capability.owners.map((item) => `- ${item}`),
      "",
    );
    renderSurfaces(
      lines,
      "Database model",
      capability.surfaces.filter(
        (surface) =>
          surface.kind === "database" ||
          (surface.kind === "generated" && surface.paths.some(isGeneratedDatabase)),
      ),
    );
    renderSurfaces(
      lines,
      "Core SDK and APIs",
      capability.surfaces.filter((surface) => surface.kind === "api"),
    );
    renderSurfaces(
      lines,
      "Other affected areas",
      capability.surfaces.filter(
        (surface) =>
          surface.kind !== "database" &&
          surface.kind !== "api" &&
          !(surface.kind === "generated" && surface.paths.some(isGeneratedDatabase)),
      ),
    );
    lines.push(
      "### Verification references",
      "",
      "These identify relevant checks; listing them does not assert that they passed for a deployment.",
      "",
      ...capability.verification.map((item) => `- ${item}`),
      "",
    );
    if (capability.limitations.length)
      lines.push(
        "### Known limitations",
        "",
        ...capability.limitations.map((item) => `- ${item}`),
        "",
      );
    lines.push(
      "### Retirement condition",
      "",
      capability.retirement,
      "",
      `<details><summary>Selected patches (${capability.patches.length}) and source binding</summary>`,
      "",
      ...capability.patches.map((name) => `- [${name}](patches/${name})`),
      "",
      `Reviewed source digest: ${inlineCode(capability.sourceDigest)}`,
      "",
      "</details>",
      "",
    );
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

export function validateCatalog(
  root,
  { checkout, allowStaleDigests = false, checkMarkdown = true } = {},
) {
  root = resolve(root);
  const queue = readQueue(root);
  let catalog;
  try {
    catalog = JSON.parse(readOwnedFile(join(root, "capabilities.json")).toString("utf8"));
  } catch (error) {
    refuse(`cannot read capabilities.json: ${error.message}`);
  }
  record(catalog, catalogKeys, catalogKeys, "catalog");
  if (catalog.schemaVersion !== 1) refuse("unsupported schemaVersion; expected 1");
  for (const [key, file] of [
    ["reviewedUpstream", "upstream.lock"],
    ["reviewedResultTree", "result-tree.lock"],
  ]) {
    if (!/^[a-f0-9]{40}$/u.test(catalog[key]))
      refuse(`${key} must be a full lowercase Git object ID`);
    if (readOwnedFile(join(root, file)).toString("utf8").trim() !== catalog[key])
      refuse(`${key} is stale against ${file}; review the catalog for the selected source`);
  }
  if (!Array.isArray(catalog.capabilities)) refuse("capabilities must be an array");
  const owners = new Map();
  const ids = new Set();
  const digests = {};
  for (const capability of catalog.capabilities) {
    record(capability, capabilityKeys, capabilityKeys, "capability");
    if (
      typeof capability.id !== "string" ||
      !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(capability.id) ||
      capability.id.length > 64
    )
      refuse("capability id must be a kebab-case identifier of at most 64 characters");
    if (ids.has(capability.id)) refuse(`duplicate capability id ${capability.id}`);
    ids.add(capability.id);
    for (const key of ["title", "motivation", "retirement"])
      text(capability[key], `${capability.id}.${key}`);
    if (capability.title.includes("\n")) refuse(`${capability.id}.title must be one line`);
    stringArray(capability.patches, `${capability.id}.patches`);
    for (const name of capability.patches) {
      patchName(name, capability.id);
      if (!queue.hashes.has(name)) refuse(`${capability.id} owns unselected/removed patch ${name}`);
      if (owners.has(name))
        refuse(`${name} has multiple capability owners: ${owners.get(name)}, ${capability.id}`);
      owners.set(name, capability.id);
    }
    stringArray(capability.verification, `${capability.id}.verification`);
    stringArray(capability.behavior, `${capability.id}.behavior`);
    stringArray(capability.owners, `${capability.id}.owners`);
    stringArray(capability.limitations, `${capability.id}.limitations`, true);
    if (!/^[a-f0-9]{64}$/u.test(capability.sourceDigest))
      refuse(`${capability.id}.sourceDigest must be a lowercase SHA256`);
    const digest = computeSourceDigest(catalog.reviewedUpstream, capability.patches, queue);
    digests[capability.id] = digest;
    if (!allowStaleDigests && digest !== capability.sourceDigest)
      refuse(
        `${capability.id} sourceDigest is stale; review its affected areas/state/API explanations and shared-source patch dependencies, then record the reviewed digest`,
      );
    if (!Array.isArray(capability.surfaces)) refuse(`${capability.id}.surfaces must be an array`);
    const paths = new Set();
    const touched = new Set(capability.patches.flatMap((name) => [...queue.paths.get(name)]));
    for (const [index, surface] of capability.surfaces.entries()) {
      const label = `${capability.id}.surfaces[${index}]`;
      record(surface, surfaceKeys, ["kind", "paths", "summary", "why"], label);
      if (!surfaceKinds.has(surface.kind)) refuse(`${label} has unknown kind ${surface.kind}`);
      text(surface.summary, `${label}.summary`);
      text(surface.why, `${label}.why`);
      stringArray(surface.paths, `${label}.paths`);
      if (surface.symbols !== undefined) stringArray(surface.symbols, `${label}.symbols`);
      if (surface.kind === "database" || surface.kind === "api")
        stringArray(surface.symbols, `${label}.symbols`);
      if (surface.kind === "api") {
        if (!["public", "private", "internal"].includes(surface.visibility))
          refuse(`${label}.visibility must classify the API as public/private/internal`);
      } else if (surface.visibility !== undefined)
        refuse(`${label}.visibility only applies to API surfaces`);
      for (const path of surface.paths) {
        sourcePath(path, label);
        if (paths.has(path)) refuse(`${capability.id} lists source path more than once: ${path}`);
        if (!touched.has(path))
          refuse(`${capability.id} declares a source path its patches never touch: ${path}`);
        paths.add(path);
      }
    }
  }
  for (const name of queue.series)
    if (!owners.has(name)) refuse(`selected patch has no capability owner: ${name}`);
  if (checkout) validateCheckout(root, checkout, catalog, queue);
  const markdown = renderCatalog(catalog);
  if (checkMarkdown && readOwnedFile(join(root, "CAPABILITIES.md")).toString("utf8") !== markdown)
    refuse(
      "CAPABILITIES.md is stale; run node scripts/check-capability-catalog.mjs --write after reviewing capabilities.json",
    );
  return { catalog, queue, digests, markdown };
}

function main(args) {
  const options = {
    root: resolve(dirname(fileURLToPath(import.meta.url)), ".."),
    checkout: undefined,
    write: false,
    printDigests: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option === "--root" || option === "--checkout") {
      if (!args[index + 1] || args[index + 1].startsWith("--")) refuse(`${option} requires a path`);
      options[option === "--root" ? "root" : "checkout"] = resolve(args[++index]);
    } else if (option === "--write") options.write = true;
    else if (option === "--print-source-digests") options.printDigests = true;
    else if (option !== "--check") refuse(`unknown option ${option}`);
  }
  if (options.write && options.printDigests)
    refuse("--write and --print-source-digests are separate operations");
  const state = validateCatalog(options.root, {
    checkout: options.checkout,
    allowStaleDigests: options.printDigests,
    checkMarkdown: !options.write && !options.printDigests,
  });
  if (options.printDigests) console.log(JSON.stringify(state.digests, null, 2));
  else if (options.write) {
    writeFileSync(join(options.root, "CAPABILITIES.md"), state.markdown);
    console.log("CAPABILITIES.md rendered from reviewed capabilities.json");
  } else
    console.log(
      `capability catalog verified: ${state.catalog.capabilities.length} capabilities, ${state.queue.series.length} patches${options.checkout ? ", exact net source coverage" : ""}`,
    );
}

if (
  process.argv[1] &&
  existsSync(process.argv[1]) &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
