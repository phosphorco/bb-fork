import Database from "better-sqlite3";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  rosettaMigrationReceipts,
  runRosettaMigrationBridgeLocked,
} from "../src/rosetta-migration-bridge.js";
import { readPackagedMigrationReceipts } from "../src/migrate.js";
import { createConnection } from "../src/connection.js";
import { migrate } from "../src/migrate.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function createLegacyDatabase(): string {
  const directory = mkdtempSync(join(tmpdir(), "bb-rosetta-bridge-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "bb.db");
  const db = new Database(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE __drizzle_migrations (
      id integer PRIMARY KEY AUTOINCREMENT,
      hash text NOT NULL,
      created_at numeric
    );
    CREATE TABLE threads (
      id text PRIMARY KEY NOT NULL,
      p6r_created_by_handle text
    );
    CREATE TABLE events (
      id text PRIMARY KEY NOT NULL,
      thread_id text NOT NULL,
      item_id text,
      sequence integer NOT NULL,
      item_kind text,
      type text NOT NULL,
      tool_name text GENERATED ALWAYS AS (json_extract('{}', '$.name')) VIRTUAL,
      p6r_actor_handle text,
      p6r_actor_provider_id text,
      p6r_actor_subject text,
      p6r_actor_display_name text,
      p6r_actor_image_url text
    );
    CREATE INDEX events_tool_call_parent_lookup_idx ON events(thread_id, tool_name);
    CREATE INDEX events_todo_tool_call_thread_tool_sequence_idx ON events(thread_id, tool_name, sequence);
    CREATE TABLE pending_interactions (
      id text PRIMARY KEY NOT NULL,
      p6r_resolved_by_handle text
    );
    CREATE TABLE queued_thread_messages (
      id text PRIMARY KEY NOT NULL,
      p6r_actor_handle text,
      p6r_actor_provider_id text,
      p6r_actor_subject text,
      p6r_actor_display_name text,
      p6r_actor_image_url text
    );
    CREATE TABLE plugin_marketplaces (id text PRIMARY KEY NOT NULL);
    CREATE TABLE p6r_actors (
      p6r_provider_id text NOT NULL,
      p6r_subject text NOT NULL,
      p6r_handle text NOT NULL,
      p6r_display_name text NOT NULL,
      p6r_image_url text,
      p6r_first_seen_at integer NOT NULL,
      p6r_last_seen_at integer NOT NULL,
      PRIMARY KEY(p6r_provider_id, p6r_subject)
    );
    CREATE TABLE p6r_collaborators (
      p6r_handle text PRIMARY KEY NOT NULL,
      p6r_display_name text NOT NULL,
      p6r_image_url text,
      p6r_first_seen_at integer NOT NULL,
      p6r_last_seen_at integer NOT NULL
    );
    CREATE TABLE thread_facet_cursor_keys (key_id text PRIMARY KEY NOT NULL);
    CREATE TABLE thread_facet_declarations (type_scope text NOT NULL);
    CREATE TABLE thread_facet_members (type_scope text NOT NULL);
    CREATE TABLE thread_facet_owners (type_scope text NOT NULL);
    CREATE TABLE thread_facet_principal_profiles (type_scope text NOT NULL);
    CREATE TABLE thread_facet_reconciliation_targets (type_scope text NOT NULL);
    CREATE TABLE thread_facet_relations (type_scope text NOT NULL);
    CREATE TABLE thread_facet_snapshots (type_scope text NOT NULL);
  `);
  const insert = db.prepare(
    "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
  );
  for (const receipt of readPackagedMigrationReceipts()) {
    if (receipt.createdAt >= rosettaMigrationReceipts.upstream0107.createdAt) {
      break;
    }
    insert.run(receipt.hash, receipt.createdAt);
  }
  insert.run(
    rosettaMigrationReceipts.legacyIdentity.hash,
    rosettaMigrationReceipts.legacyIdentity.createdAt,
  );
  insert.run(
    rosettaMigrationReceipts.legacyFacets.hash,
    rosettaMigrationReceipts.legacyFacets.createdAt,
  );
  db.close();
  return path;
}

function ledger(path: string): Array<{ createdAt: number; hash: string }> {
  const db = new Database(path, { readonly: true });
  try {
    return db
      .prepare(
        "SELECT created_at AS createdAt, hash FROM __drizzle_migrations ORDER BY created_at",
      )
      .all() as Array<{ createdAt: number; hash: string }>;
  } finally {
    db.close();
  }
}

describe("Rosetta migration bridge", () => {
  it("recognizes a freshly migrated exact target without adding legacy state", () => {
    const directory = mkdtempSync(join(tmpdir(), "bb-rosetta-fresh-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "bb.db");
    const db = createConnection(path);
    migrate(db);
    db.$client.close();
    const beforeLedger = ledger(path);

    expect(runRosettaMigrationBridgeLocked(path)).toMatchObject({
      changed: false,
      state: "target",
    });
    expect(ledger(path)).toEqual(beforeLedger);
    expect(beforeLedger).not.toContainEqual(
      rosettaMigrationReceipts.legacyFacets,
    );
  });

  it("adopts the exact legacy shape and preserves historical receipts", () => {
    const path = createLegacyDatabase();

    expect(runRosettaMigrationBridgeLocked(path)).toMatchObject({
      changed: true,
      state: "target",
    });

    const rows = ledger(path);
    expect(rows).toEqual(
      expect.arrayContaining([
        rosettaMigrationReceipts.legacyIdentity,
        rosettaMigrationReceipts.legacyFacets,
        rosettaMigrationReceipts.upstream0107,
        rosettaMigrationReceipts.upstream0108,
        rosettaMigrationReceipts.upstream0109,
        rosettaMigrationReceipts.targetIdentity,
      ]),
    );
  });

  it("makes ordinary startup refuse the recognized legacy state", () => {
    const path = createLegacyDatabase();
    const db = createConnection(path);
    try {
      expect(() => migrate(db)).toThrow("bb-migrate-rosetta --database");
    } finally {
      db.$client.close();
    }
  });

  it("is a mutation-free no-op on a verified target", () => {
    const path = createLegacyDatabase();
    runRosettaMigrationBridgeLocked(path);
    const before = readFileSync(path);
    const beforeLedger = ledger(path);

    expect(runRosettaMigrationBridgeLocked(path)).toMatchObject({
      changed: false,
      state: "target",
    });
    expect(ledger(path)).toEqual(beforeLedger);
    expect(readFileSync(path)).toEqual(before);
  });

  it("rejects a partially adopted ledger", () => {
    const path = createLegacyDatabase();
    const db = new Database(path);
    db.prepare(
      "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
    ).run(
      rosettaMigrationReceipts.upstream0107.hash,
      rosettaMigrationReceipts.upstream0107.createdAt,
    );
    db.close();

    expect(() => runRosettaMigrationBridgeLocked(path)).toThrow(
      "partially adopted",
    );
  });

  it("rejects recovery artifacts", () => {
    const path = createLegacyDatabase();
    const db = new Database(path);
    db.exec("CREATE TABLE _bb_p6r_recovery (id text)");
    db.close();

    expect(() => runRosettaMigrationBridgeLocked(path)).toThrow(
      "recovery/staging object",
    );
  });

  it("rejects an unknown tool_name dependency", () => {
    const path = createLegacyDatabase();
    const db = new Database(path);
    db.exec(
      "CREATE VIEW unknown_tool_dependency AS SELECT tool_name FROM events",
    );
    db.close();

    expect(() => runRosettaMigrationBridgeLocked(path)).toThrow(
      "unknown events.tool_name dependency",
    );
  });
});
