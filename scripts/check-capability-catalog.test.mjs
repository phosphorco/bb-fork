import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import {
  computeSourceDigest,
  readQueue,
  renderCatalog,
  sha256,
  validateCatalog,
} from "./check-capability-catalog.mjs";

const checker = resolve(import.meta.dirname, "check-capability-catalog.mjs");
const publicPath = "packages/plugin-sdk/src/backend-contract.ts";
const privatePath = "apps/server/src/services/p6r/identity-protocol.ts";
const databasePath = "packages/db/src/schema.ts";
const sidecarPath = "apps/server/src/services/p6r/sidecar-store.ts";
const runtimePath = "apps/app/src/read-state.ts";
const grammarFixturePath =
  "packages/provider-bridge-protocol/src/contract-tests/provider-bridge-grammar.v2.snapshot.json";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "bb-capability-catalog-"));
  const checkout = join(root, "checkout");
  mkdirSync(checkout);
  mkdirSync(join(root, "patches"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", ["-C", checkout, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  function source(path, contents) {
    const target = join(checkout, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents);
  }
  git("init", "--quiet");
  git("config", "commit.gpgsign", "false");
  git("config", "core.hooksPath", join(checkout, ".git/hooks"));
  git("config", "core.fsmonitor", "false");
  git("config", "user.name", "Capability Fixture");
  git("config", "user.email", "capability-fixture@example.invalid");
  source(publicPath, "export interface Backend {}\n");
  source(databasePath, "export const tables = [];\n");
  source(runtimePath, "export const pending = false;\n");
  source("apps/app/src/old name.ts", "export const retained = true;\n");
  git("add", ".");
  git("commit", "--quiet", "-m", "upstream baseline");
  const upstream = git("rev-parse", "HEAD");
  source(publicPath, "export interface Backend { sharedIdentity: SharedIdentity; }\n");
  source(privatePath, "export interface SharedIdentity { actor: string; }\n");
  source(databasePath, "export const tables = ['authorship_receipts'];\n");
  source(sidecarPath, "export function readReceipt(id) { return id; }\n");
  source("packages/plugin-sdk/src/testing/fake-host.ts", "export function makeFixtureHost() {}\n");
  source("packages/db/src/receipt.test.ts", "export const testReceipt = true;\n");
  source(grammarFixturePath, '{"grammar":"recorded"}\n');
  git("add", ".");
  git("commit", "--quiet", "-m", "retain shared authorship");
  const first = "0001-shared-authorship.patch";
  writeFileSync(join(root, "patches", first), `${git("format-patch", "--stdout", "-1")}\n`);
  const firstCommit = git("rev-parse", "HEAD");
  source(runtimePath, "export const pending = true;\n");
  git("add", ".");
  git("commit", "--quiet", "-m", "show pending reads explicitly");
  const second = "0002-pending-reads.patch";
  writeFileSync(join(root, "patches", second), `${git("format-patch", "--stdout", "-1")}\n`);
  const queue = [first, second];
  function writeQueue() {
    writeFileSync(join(root, "patches/series"), `${queue.join("\n")}\n`);
    writeFileSync(
      join(root, "patches/sha256"),
      queue
        .map((name) => `${sha256(readFileSync(join(root, "patches", name)))}  ${name}\n`)
        .join(""),
    );
  }
  writeQueue();
  writeFileSync(join(root, "upstream.lock"), `${upstream}\n`);
  writeFileSync(join(root, "result-tree.lock"), `${git("rev-parse", "HEAD^{tree}")}\n`);
  const surface = (kind, paths, summary, symbols, visibility) => ({
    kind,
    paths,
    summary,
    why: "The selected capability needs this source responsibility.",
    ...(symbols ? { symbols } : {}),
    ...(visibility ? { visibility } : {}),
  });
  const catalog = {
    schemaVersion: 1,
    reviewedUpstream: upstream,
    reviewedResultTree: git("rev-parse", "HEAD^{tree}"),
    capabilities: [
      {
        id: "shared-authorship",
        title: "Shared authorship",
        motivation: "Preserve a person's original attribution across shared execution.",
        behavior: ["Retain the original actor."],
        owners: ["The server owns authorship receipts."],
        patches: [first],
        sourceDigest: "0".repeat(64),
        surfaces: [
          surface(
            "api",
            [publicPath],
            "Expose explicit attribution to plugins.",
            ["Backend.sharedIdentity"],
            "public",
          ),
          surface(
            "api",
            [privatePath],
            "Bind internal actor evidence.",
            ["SharedIdentity.actor"],
            "private",
          ),
          surface("database", [databasePath, sidecarPath], "Retain authorship receipts.", [
            "authorship_receipts",
            "readReceipt",
          ]),
          surface(
            "verification",
            [
              "packages/plugin-sdk/src/testing/fake-host.ts",
              "packages/db/src/receipt.test.ts",
              grammarFixturePath,
            ],
            "Exercise public and stored attribution through fixtures.",
          ),
        ],
        verification: ["test/attribution.test.ts checks retained authorship."],
        retirement: "Retire when upstream preserves the same actor and receipt contract.",
        limitations: [],
      },
      {
        id: "pending-reads",
        title: "Pending reads",
        motivation: "Avoid claiming that a still-pending result is empty.",
        behavior: ["Show pending state until a result arrives."],
        owners: ["The read controller owns pending state."],
        patches: [second],
        sourceDigest: "0".repeat(64),
        surfaces: [
          surface(
            "runtime",
            [runtimePath],
            "Keep the current attempt separate from accepted results.",
          ),
        ],
        verification: ["test/read-state.test.ts checks pending and accepted result transitions."],
        retirement: "Retire when native read owners preserve the same lifecycle.",
        limitations: ["A retained result is not a provider readiness check."],
      },
    ],
  };
  function writeCatalog({ bind = false, render = true } = {}) {
    if (bind) {
      const data = readQueue(root);
      for (const capability of catalog.capabilities)
        capability.sourceDigest = computeSourceDigest(
          catalog.reviewedUpstream,
          capability.patches,
          data,
        );
    }
    writeFileSync(join(root, "capabilities.json"), `${JSON.stringify(catalog, null, 2)}\n`);
    if (render) writeFileSync(join(root, "CAPABILITIES.md"), renderCatalog(catalog));
  }
  writeCatalog({ bind: true });
  function appendPatch(name, changes) {
    for (const [path, contents] of Object.entries(changes)) source(path, contents);
    git("add", ".");
    git("commit", "--quiet", "-m", name);
    writeFileSync(join(root, "patches", name), `${git("format-patch", "--stdout", "-1")}\n`);
    queue.push(name);
    writeQueue();
    catalog.reviewedResultTree = git("rev-parse", "HEAD^{tree}");
    writeFileSync(join(root, "result-tree.lock"), `${catalog.reviewedResultTree}\n`);
  }
  return {
    root,
    checkout,
    git,
    source,
    first,
    second,
    firstCommit,
    queue,
    catalog,
    surface,
    writeQueue,
    writeCatalog,
    appendPatch,
    check: () => validateCatalog(root, { checkout }),
    cli: (...args) =>
      spawnSync(process.execPath, [checker, "--root", root, ...args], { encoding: "utf8" }),
  };
}

test("accepts a complete source-bound catalog, including private APIs and test helpers", (t) => {
  const f = fixture(t);
  const result = f.check();
  assert.equal(result.queue.series.length, 2);
  assert.match(result.markdown, /authorship_receipts/u);
  assert.match(result.markdown, /Backend\.sharedIdentity/u);
  assert.match(result.markdown, /A retained result is not a provider readiness check/u);
  assert.equal(f.cli("--checkout", f.checkout).status, 0);
});

test("CLI invoked through a symlink validates rather than silently bypassing its entrypoint", (t) => {
  const f = fixture(t);
  const linkedChecker = join(f.root, "linked-checker.mjs");
  symlinkSync(checker, linkedChecker);
  const run = () =>
    spawnSync(process.execPath, [linkedChecker, "--root", f.root, "--checkout", f.checkout], {
      encoding: "utf8",
    });
  const valid = run();
  assert.equal(valid.status, 0, valid.stderr);
  assert.match(valid.stdout, /capability catalog verified/u);
  f.catalog.capabilities[0].surfaces.shift();
  f.writeCatalog();
  const rejected = run();
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /uncataloged changed source path packages\/plugin-sdk/u);
});

test("requires ownership when a selected source patch is added", (t) => {
  const f = fixture(t);
  f.appendPatch("0003-new-API.patch", {
    "packages/sdk/src/new-action.ts": "export function repairAccount() {}\n",
  });
  f.writeCatalog();
  assert.throws(f.check, /selected patch has no capability owner/u);
});

test("requires an affected surface even after a new patch and review digest are assigned", (t) => {
  const f = fixture(t);
  f.appendPatch("0003-new-API.patch", {
    "packages/sdk/src/new-action.ts": "export function repairAccount() {}\n",
  });
  f.catalog.capabilities[0].patches.push("0003-new-API.patch");
  f.writeCatalog({ bind: true });
  assert.throws(f.check, /uncataloged changed source path packages\/sdk\/src\/new-action.ts/u);
});

test("rejects orphan catalog and checksum entries when a patch is removed", (t) => {
  const f = fixture(t);
  f.queue.pop();
  unlinkSync(join(f.root, "patches", f.second));
  f.writeQueue();
  assert.throws(f.check, /owns unselected\/removed patch/u);
  writeFileSync(join(f.root, "patches/sha256"), `${sha256("orphan")}  absent.patch\n`);
  assert.throws(f.check, /orphan checksum entry/u);
});

test("permits a deliberate removal with updated catalog, source tree and rendered view", (t) => {
  const f = fixture(t);
  f.queue.pop();
  unlinkSync(join(f.root, "patches", f.second));
  f.writeQueue();
  f.git("checkout", "--detach", f.firstCommit);
  f.catalog.capabilities.pop();
  f.catalog.reviewedResultTree = f.git("rev-parse", "HEAD^{tree}");
  writeFileSync(join(f.root, "result-tree.lock"), `${f.catalog.reviewedResultTree}\n`);
  f.writeCatalog({ bind: true });
  assert.equal(f.check().catalog.capabilities.length, 1);
  assert.match(f.check().markdown, /Backend\.sharedIdentity/u);
});

test("rejects a patch-byte edit even if its ordinary checksum is refreshed", (t) => {
  const f = fixture(t);
  const path = join(f.root, "patches", f.first);
  writeFileSync(path, `${readFileSync(path, "utf8")}\n`);
  f.writeQueue();
  assert.throws(f.check, /sourceDigest is stale/u);
});

test("overlapping patch changes require every affected capability review without staling an independent capability", (t) => {
  const f = fixture(t);
  const name = "0003-provider-notices.patch";
  f.appendPatch(name, {
    [publicPath]:
      "export interface Backend { sharedIdentity: SharedIdentity; providerNotice: string; }\n",
  });
  f.catalog.capabilities.push({
    id: "provider-notices",
    title: "Provider notices",
    motivation: "Expose actionable provider status beside shared identity.",
    behavior: ["Retain provider notice text."],
    owners: ["The public contract owns provider notice transport."],
    patches: [name],
    sourceDigest: "0".repeat(64),
    surfaces: [
      f.surface(
        "api",
        [publicPath],
        "Expose a provider notice.",
        ["Backend.providerNotice"],
        "public",
      ),
    ],
    verification: ["test/notices.test.ts checks notice transport."],
    retirement: "Retire when upstream owns the same notice contract.",
    limitations: [],
  });
  f.writeCatalog({ bind: true });
  f.check();
  const independentDigest = f.catalog.capabilities[1].sourceDigest;
  const patch = join(f.root, "patches", name);
  writeFileSync(patch, `${readFileSync(patch, "utf8")}\n`);
  f.writeQueue();
  const queue = readQueue(f.root);
  f.catalog.capabilities[2].sourceDigest = computeSourceDigest(
    f.catalog.reviewedUpstream,
    [name],
    queue,
  );
  f.writeCatalog();
  assert.throws(f.check, /shared-authorship sourceDigest is stale/u);
  assert.equal(
    computeSourceDigest(f.catalog.reviewedUpstream, [f.second], queue),
    independentDigest,
  );
  f.catalog.capabilities[0].sourceDigest = computeSourceDigest(
    f.catalog.reviewedUpstream,
    [f.first],
    queue,
  );
  f.writeCatalog();
  assert.equal(f.check().catalog.capabilities.length, 3);
});

test("requires review when the upstream lock changes", (t) => {
  const f = fixture(t);
  writeFileSync(join(f.root, "upstream.lock"), `${"a".repeat(40)}\n`);
  assert.throws(f.check, /reviewedUpstream is stale/u);
  f.catalog.reviewedUpstream = "a".repeat(40);
  f.writeCatalog();
  assert.throws(f.check, /sourceDigest is stale/u);
});

test("refuses duplicate, unsafe and unselected queue entries", (t) => {
  const f = fixture(t);
  writeFileSync(join(f.root, "patches/series"), `${f.first}\n${f.first}\n`);
  assert.throws(f.check, /duplicate series entry/u);
  writeFileSync(join(f.root, "patches/series"), "../escape.patch\n");
  assert.throws(f.check, /unsafe patch filename/u);
  f.writeQueue();
  writeFileSync(join(f.root, "patches/unselected.patch"), "not selected\n");
  assert.throws(f.check, /unselected patch file/u);
});

test("refuses duplicate checksums and multiple capability owners", (t) => {
  const f = fixture(t);
  const path = join(f.root, "patches/sha256");
  writeFileSync(
    path,
    readFileSync(path, "utf8") + readFileSync(path, "utf8").split("\n")[0] + "\n",
  );
  assert.throws(f.check, /duplicate checksum entry/u);
  f.writeQueue();
  f.catalog.capabilities[1].patches.push(f.first);
  f.writeCatalog({ bind: true });
  assert.throws(f.check, /multiple capability owners/u);
});

test("refuses stale generated Markdown and writes only reviewed metadata", (t) => {
  const f = fixture(t);
  const path = join(f.root, "CAPABILITIES.md");
  writeFileSync(path, "obsolete catalog\n");
  assert.throws(f.check, /CAPABILITIES.md is stale/u);
  assert.equal(f.cli("--write").status, 0);
  assert.equal(readFileSync(path, "utf8"), renderCatalog(f.catalog));
  f.catalog.capabilities[0].sourceDigest = "0".repeat(64);
  f.writeCatalog({ render: false });
  const prior = readFileSync(path, "utf8");
  assert.notEqual(f.cli("--write").status, 0);
  assert.equal(readFileSync(path, "utf8"), prior);
});

test("printing review digests never rewrites the catalog or claims review", (t) => {
  const f = fixture(t);
  f.catalog.capabilities[0].sourceDigest = "0".repeat(64);
  f.writeCatalog();
  const before = readFileSync(join(f.root, "capabilities.json"), "utf8");
  const result = f.cli("--print-source-digests");
  assert.equal(result.status, 0, result.stderr);
  assert.notEqual(JSON.parse(result.stdout)["shared-authorship"], "0".repeat(64));
  assert.equal(readFileSync(join(f.root, "capabilities.json"), "utf8"), before);
  assert.throws(f.check, /sourceDigest is stale/u);
});

test("rejects missing public API coverage and misclassified database or sidecar state", (t) => {
  const f = fixture(t);
  const surfaces = f.catalog.capabilities[0].surfaces;
  const removed = surfaces.shift();
  f.writeCatalog();
  assert.throws(f.check, /uncataloged changed source path packages\/plugin-sdk/u);
  surfaces.unshift(removed);
  surfaces[0].kind = "runtime";
  delete surfaces[0].visibility;
  f.writeCatalog();
  assert.throws(f.check, /requires api classification/u);
  surfaces[0].kind = "api";
  surfaces[0].visibility = "public";
  surfaces[2].kind = "runtime";
  f.writeCatalog();
  assert.throws(f.check, /requires database classification/u);
  surfaces[2].paths = [databasePath];
  surfaces.push(f.surface("runtime", [sidecarPath], "Read retained state."));
  surfaces[2].kind = "database";
  f.writeCatalog();
  assert.throws(f.check, /sidecar-store\.ts requires database classification/u);
});

test("distinguishes private implementation contracts from public SDK contracts", (t) => {
  const f = fixture(t);
  f.catalog.capabilities[0].surfaces[1].visibility = "public";
  f.writeCatalog();
  assert.throws(f.check, /private\/internal implementation contract/u);
  f.catalog.capabilities[0].surfaces[1].visibility = "private";
  delete f.catalog.capabilities[0].surfaces[0].symbols;
  f.writeCatalog();
  assert.throws(f.check, /symbols must be a nonempty array/u);
});

for (const [label, path, symbol] of [
  ["host-daemon wire contract", "packages/host-daemon-contract/src/messages.ts", "HostMessage"],
  ["client-core public entrypoint", "packages/client-core/src/index.ts", "ClientAction"],
]) {
  test(`requires API classification for the ${label}`, (t) => {
    const f = fixture(t);
    const patch = "0003-public-contract.patch";
    f.appendPatch(patch, { [path]: `export interface ${symbol} { operation: string; }\n` });
    f.catalog.capabilities[0].patches.push(patch);
    const surface = f.surface("runtime", [path], "Carry the explicit operation contract.");
    f.catalog.capabilities[0].surfaces.push(surface);
    f.writeCatalog({ bind: true });
    assert.throws(f.check, /requires api classification/u);
    surface.kind = "api";
    surface.symbols = [symbol];
    surface.visibility = "public";
    f.writeCatalog();
    assert.equal(f.check().catalog.capabilities[0].surfaces.at(-1).kind, "api");
  });
}

test("keeps frozen contract-test recordings separate from public API declarations", (t) => {
  const f = fixture(t);
  const surfaces = f.catalog.capabilities[0].surfaces;
  surfaces[3].paths = surfaces[3].paths.filter((path) => path !== grammarFixturePath);
  surfaces.push(
    f.surface(
      "api",
      [grammarFixturePath],
      "Recorded grammar expectations.",
      ["recorded grammar"],
      "public",
    ),
  );
  f.writeCatalog();
  assert.throws(f.check, /requires verification classification/u);
});

test("rejects unknown fields, unfinished descriptions and duplicate source paths", (t) => {
  const f = fixture(t);
  f.catalog.capabilities[0].implicitApproval = true;
  f.writeCatalog();
  assert.throws(f.check, /unknown field implicitApproval/u);
  delete f.catalog.capabilities[0].implicitApproval;
  f.catalog.capabilities[0].surfaces[0].why = "TODO explain this";
  f.writeCatalog();
  assert.throws(f.check, /unfinished placeholder/u);
  f.catalog.capabilities[0].surfaces[0].why = "Carry accepted actor identity.";
  f.catalog.capabilities[0].surfaces.push({ ...f.catalog.capabilities[0].surfaces[0] });
  f.writeCatalog();
  assert.throws(f.check, /lists source path more than once/u);
});

test("refuses dirty, wrong-tree and unrelated-base checkouts", (t) => {
  const f = fixture(t);
  f.source(runtimePath, "uncommitted source\n");
  assert.throws(f.check, /checkout has authored changes/u);
  f.source(runtimePath, "export const pending = true;\n");
  f.catalog.reviewedResultTree = "b".repeat(40);
  writeFileSync(join(f.root, "result-tree.lock"), `${f.catalog.reviewedResultTree}\n`);
  f.writeCatalog();
  assert.throws(f.check, /checkout tree differs/u);
  f.catalog.reviewedResultTree = f.git("rev-parse", "HEAD^{tree}");
  writeFileSync(join(f.root, "result-tree.lock"), `${f.catalog.reviewedResultTree}\n`);
  f.catalog.reviewedUpstream = f.git(
    "commit-tree",
    f.catalog.reviewedResultTree,
    "-m",
    "unrelated upstream history",
  );
  writeFileSync(join(f.root, "upstream.lock"), `${f.catalog.reviewedUpstream}\n`);
  f.writeCatalog({ bind: true });
  assert.throws(f.check, /git merge-base failed/u);
});

test("tracks both sides of a rename, including source paths containing spaces", (t) => {
  const f = fixture(t);
  f.git("mv", "apps/app/src/old name.ts", "apps/app/src/new name.ts");
  f.git("commit", "--quiet", "-m", "rename retained module");
  const name = "0003-rename.patch";
  writeFileSync(join(f.root, "patches", name), `${f.git("format-patch", "--stdout", "-1")}\n`);
  f.queue.push(name);
  f.writeQueue();
  f.catalog.capabilities[1].patches.push(name);
  f.catalog.capabilities[1].surfaces.push(
    f.surface(
      "runtime",
      ["apps/app/src/old name.ts", "apps/app/src/new name.ts"],
      "Move the retained module without changing its behavior.",
    ),
  );
  f.catalog.reviewedResultTree = f.git("rev-parse", "HEAD^{tree}");
  writeFileSync(join(f.root, "result-tree.lock"), `${f.catalog.reviewedResultTree}\n`);
  f.writeCatalog({ bind: true });
  assert.equal(f.check().queue.series.length, 3);
});

test("can represent complete retirement of the downstream queue", (t) => {
  const f = fixture(t);
  for (const name of f.queue) unlinkSync(join(f.root, "patches", name));
  f.queue.length = 0;
  f.writeQueue();
  f.git("checkout", "--detach", f.catalog.reviewedUpstream);
  f.catalog.capabilities = [];
  f.catalog.reviewedResultTree = f.git("rev-parse", "HEAD^{tree}");
  writeFileSync(join(f.root, "result-tree.lock"), `${f.catalog.reviewedResultTree}\n`);
  f.writeCatalog();
  assert.equal(f.check().queue.series.length, 0);
});
