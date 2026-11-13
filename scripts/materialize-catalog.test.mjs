import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import {
  computeSourceDigest,
  readQueue,
  renderCatalog,
  sha256,
} from "./check-capability-catalog.mjs";

test("official materialization rejects missing API coverage and retains the failed candidate", () => {
  const root = mkdtempSync(join(tmpdir(), "bb-catalog-materialize-"));
  const upstream = join(root, "upstream");
  function git(repo, ...args) {
    return execFileSync(
      "git",
      [
        "-c",
        "commit.gpgsign=false",
        "-c",
        "core.hooksPath=/dev/null",
        "-c",
        "core.fsmonitor=false",
        "-C",
        repo,
        ...args,
      ],
      { encoding: "utf8" },
    ).trim();
  }
  function write(path, content) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  function initialize(repo) {
    mkdirSync(repo, { recursive: true });
    git(repo, "init", "--quiet");
    git(repo, "config", "user.name", "Catalog Fixture");
    git(repo, "config", "user.email", "catalog@example.invalid");
    git(repo, "config", "commit.gpgsign", "false");
    git(repo, "config", "core.hooksPath", "/dev/null");
    git(repo, "config", "core.fsmonitor", "false");
  }
  try {
    initialize(root);
    initialize(upstream);
    write(join(upstream, "README.md"), "fixture base\n");
    git(upstream, "add", ".");
    git(upstream, "commit", "--quiet", "-m", "base");
    const base = git(upstream, "rev-parse", "HEAD");
    const candidate = join(root, "candidate");
    git(upstream, "worktree", "add", "--quiet", "--detach", candidate, base);
    const source = "packages/plugin-sdk/src/fixture-contract.ts";
    write(join(candidate, source), "export interface FixtureContract { operationId: string; }\n");
    git(candidate, "add", ".");
    git(candidate, "commit", "--quiet", "-m", "add public contract");
    const resultTree = git(candidate, "rev-parse", "HEAD^{tree}");
    const patch = git(candidate, "format-patch", "--stdout", "-1") + "\n";
    const name = "0001-add-public-contract.patch";
    write(join(root, "patches", name), patch);
    write(join(root, "patches/series"), name + "\n");
    write(join(root, "patches/sha256"), `${sha256(patch)}  ${name}\n`);
    write(join(root, "upstream.lock"), base + "\n");
    write(join(root, "result-tree.lock"), resultTree + "\n");
    for (const script of ["materialize", "check-capability-catalog.mjs"]) {
      mkdirSync(join(root, "scripts"), { recursive: true });
      copyFileSync(new URL(script, import.meta.url), join(root, "scripts", script));
    }
    const capability = {
      id: "fixture-contract",
      title: "Carry caller operation identity",
      motivation: "Callers need a stable identity across accepted retries.",
      behavior: ["The public contract requires operationId."],
      owners: ["The SDK owns the caller contract."],
      patches: [name],
      sourceDigest: computeSourceDigest(base, [name], readQueue(root)),
      surfaces: [],
      verification: ["The fixture introduces the actual TypeScript interface."],
      retirement: "Retire when upstream supplies this contract.",
      limitations: [],
    };
    const catalog = {
      schemaVersion: 1,
      reviewedUpstream: base,
      reviewedResultTree: resultTree,
      capabilities: [capability],
    };
    function publishCatalog() {
      write(join(root, "capabilities.json"), JSON.stringify(catalog));
      write(join(root, "CAPABILITIES.md"), renderCatalog(catalog));
    }
    function materialize(output) {
      return spawnSync("bash", [join(root, "scripts/materialize"), output], {
        cwd: root,
        encoding: "utf8",
      });
    }
    publishCatalog();
    const failed = join(root, "failed-result");
    const rejected = materialize(failed);
    assert.notEqual(rejected.status, 0, rejected.stdout);
    assert.match(
      rejected.stderr,
      /Capability catalog: fixture-contract has uncataloged changed source path packages\/plugin-sdk\/src\/fixture-contract\.ts/u,
    );
    assert.equal(existsSync(join(failed, source)), true);
    assert.equal(git(failed, "rev-parse", "HEAD^{tree}"), resultTree);
    capability.surfaces.push({
      kind: "api",
      paths: [source],
      summary: "Adds FixtureContract.operationId.",
      why: "Give callers one operation identity across retries.",
      symbols: ["FixtureContract.operationId"],
      visibility: "public",
    });
    publishCatalog();
    const accepted = materialize(join(root, "accepted-result"));
    assert.equal(accepted.status, 0, accepted.stdout + accepted.stderr);
    assert.match(accepted.stdout, /exact net source coverage/u);
    assert.equal(git(failed, "rev-parse", "HEAD^{tree}"), resultTree);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
