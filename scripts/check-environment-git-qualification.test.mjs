import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertCapacity,
  assertMaterializedTrackedClean,
  assertNoExternalSymlinks,
  assertPackedSdkInventory,
  isInside,
} from "./check-environment-git-qualification.mjs";

test("capacity gates both free bytes and inodes", () => {
  assert.deepEqual(
    assertCapacity({ bsize: 1n, bavail: 20_000_000_000n, ffree: 250_000n }, "test"),
    { freeBytes: "20000000000", freeInodes: "250000" },
  );
  assert.throws(() => assertCapacity({ bsize: 1n, bavail: 19_999_999_999n, ffree: 250_000n }, "test"));
  assert.throws(() => assertCapacity({ bsize: 1n, bavail: 20_000_000_000n, ffree: 249_999n }, "test"));
});

test("tracked source drift refuses while ignored generated output is allowed", (t) => {
  const scratch = mkdtempSync(path.join(os.tmpdir(), "bb-env-git-tracked-test-"));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd: scratch, stdio: "pipe" });
  git("init", "-q");
  writeFileSync(path.join(scratch, ".gitignore"), "dist/\n");
  writeFileSync(path.join(scratch, "source.ts"), "export const value = 1;\n");
  git("add", ".gitignore", "source.ts");
  git("-c", "user.name=Qualification test", "-c", "user.email=test@invalid.local", "commit", "-qm", "base");
  mkdirSync(path.join(scratch, "dist"));
  writeFileSync(path.join(scratch, "dist", "index.js"), "generated\n");
  assert.doesNotThrow(() => assertMaterializedTrackedClean(scratch));
  writeFileSync(path.join(scratch, "source.ts"), "export const value = 2;\n");
  assert.throws(() => assertMaterializedTrackedClean(scratch), /tracked source changed/);
});

test("packed SDK inventory requires every public runtime and declaration target", () => {
  const manifest = {
    name: "@get-bb/plugin-sdk",
    version: "0.5.31",
    files: ["dist", "bundled-types"],
    types: "./bundled-types/index.d.ts",
    exports: { ".": { types: "./bundled-types/index.d.ts", import: "./dist/index.js" } },
  };
  const entries = ["package/", "package/package.json", "package/bundled-types/index.d.ts", "package/dist/index.js"];
  const types = ["d", "-", "-", "-"];
  assert.deepEqual(
    assertPackedSdkInventory(entries, types, manifest, manifest),
    ["package/bundled-types/index.d.ts", "package/dist/index.js"],
  );
  assert.throws(
    () => assertPackedSdkInventory(entries.slice(0, -1), types.slice(0, -1), manifest, manifest),
    /missing packed SDK export target/,
  );
  assert.throws(
    () => assertPackedSdkInventory([...entries, "package/../escape"], [...types, "-"], manifest, manifest),
    /unsafe or duplicate member/,
  );
  assert.throws(
    () => assertPackedSdkInventory(entries, ["d", "-", "l", "-"], manifest, manifest),
    /unsafe or duplicate member/,
  );
});

test("private-path containment rejects prefix collisions and resolved symlink escapes", (t) => {
  const scratch = mkdtempSync(path.join(os.tmpdir(), "bb-env-git-qual-test-"));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  const source = path.join(scratch, "source");
  const privateRoot = path.join(scratch, "private");
  const outside = path.join(scratch, "private-escape");
  mkdirSync(source);
  mkdirSync(privateRoot);
  mkdirSync(outside);
  writeFileSync(path.join(outside, "file"), "outside");
  assert.equal(isInside(privateRoot, outside), false);
  symlinkSync(path.join(outside, "file"), path.join(source, "link"));
  assert.throws(() => assertNoExternalSymlinks(source, privateRoot), /escapes private source/);
  rmSync(path.join(source, "link"));
  symlinkSync(path.join(outside, "file"), path.join(privateRoot, "link"));
  assert.throws(() => assertNoExternalSymlinks(source, privateRoot), /escapes private source/);
});
