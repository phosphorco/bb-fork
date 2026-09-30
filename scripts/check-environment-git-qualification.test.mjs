import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertCapacity,
  assertNoExternalSymlinks,
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
