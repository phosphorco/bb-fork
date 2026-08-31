#!/usr/bin/env node
import { runRosettaMigrationBridgeLocked } from "@bb/db";
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";

function fail(message: string): never {
  throw new Error(message);
}

function requireNoOpenDatabaseHandles(databasePath: string): void {
  const result = spawnSync(
    "fuser",
    ["--", databasePath, `${databasePath}-wal`, `${databasePath}-shm`],
    { encoding: "utf8" },
  );
  if (result.error !== undefined) {
    fail(`Cannot prove database writers stopped: ${result.error.message}`);
  }
  if (result.status === 0) {
    fail(
      `Database, WAL, or SHM has an open handle; stop every writer first: ${result.stdout.trim()} ${result.stderr.trim()}`.trim(),
    );
  }
  if (result.status !== 1) {
    fail(
      `Cannot prove database writers stopped: fuser exited ${String(result.status)}`,
    );
  }
}

function runUnderCanonicalLock(databaseArgument: string): never {
  const canonicalPath = realpathSync(resolve(databaseArgument));
  const lockPath = `${canonicalPath}.bb-migration.lock`;
  const result = spawnSync(
    "flock",
    [
      "--exclusive",
      "--nonblock",
      lockPath,
      process.execPath,
      process.argv[1] ?? fail("Cannot resolve migration command path"),
      "--locked-database",
      canonicalPath,
    ],
    { stdio: "inherit" },
  );
  if (result.error !== undefined) {
    fail(`Cannot acquire canonical database lock: ${result.error.message}`);
  }
  process.exit(result.status ?? 1);
}

function main(): void {
  const [mode, databaseArgument, ...extra] = process.argv.slice(2);
  if (extra.length !== 0 || databaseArgument === undefined) {
    fail(
      "Usage: bb-migrate-rosetta --database /absolute/path/to/offline-copy.db",
    );
  }
  if (mode === "--database") {
    runUnderCanonicalLock(databaseArgument);
  }
  if (mode !== "--locked-database") {
    fail(
      "Usage: bb-migrate-rosetta --database /absolute/path/to/offline-copy.db",
    );
  }
  if (resolve(databaseArgument) !== databaseArgument) {
    fail("Locked database path must be canonical and absolute");
  }
  requireNoOpenDatabaseHandles(databaseArgument);
  const result = runRosettaMigrationBridgeLocked(databaseArgument);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`bb-migrate-rosetta: ${message}\n`);
  process.exitCode = 1;
}
