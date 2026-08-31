import Database from "better-sqlite3";
import { readPackagedMigrationReceipts } from "./migrate.js";

const RECEIPTS = {
  legacyIdentity: {
    createdAt: 1_787_517_263_970,
    hash: "303073917afaade57ab1072f09d51da7f62c42df71cc4e3009906b21b6d40709",
  },
  legacyFacets: {
    createdAt: 1_787_520_353_659,
    hash: "e051e9e2591a08907d9b53bb1243a11d5c1384f07a131c4a2a9367b0b4954cce",
  },
  upstream0107: {
    createdAt: 1_787_331_095_369,
    hash: "da63f96688d22f8b573b0673d1ba9e72051fde268f27052607231cb25bfae584",
  },
  upstream0108: {
    createdAt: 1_787_613_751_578,
    hash: "0ae872521ffd026ae67358c2ab016176711bf7477aa77060076c1100a0b30790",
  },
  upstream0109: {
    createdAt: 1_787_680_413_251,
    hash: "c9ced750de5290719e05a9289ab15f65eddec720c212f6691d8a4a85d3d372d4",
  },
  targetIdentity: {
    createdAt: 1_788_093_466_101,
    hash: "303073917afaade57ab1072f09d51da7f62c42df71cc4e3009906b21b6d40709",
  },
} as const;

const FACET_TABLES = [
  "thread_facet_cursor_keys",
  "thread_facet_declarations",
  "thread_facet_members",
  "thread_facet_owners",
  "thread_facet_principal_profiles",
  "thread_facet_reconciliation_targets",
  "thread_facet_relations",
  "thread_facet_snapshots",
] as const;

const IDENTITY_COLUMNS = {
  events: [
    "p6r_actor_handle",
    "p6r_actor_provider_id",
    "p6r_actor_subject",
    "p6r_actor_display_name",
    "p6r_actor_image_url",
  ],
  pending_interactions: ["p6r_resolved_by_handle"],
  queued_thread_messages: [
    "p6r_actor_handle",
    "p6r_actor_provider_id",
    "p6r_actor_subject",
    "p6r_actor_display_name",
    "p6r_actor_image_url",
  ],
  threads: ["p6r_created_by_handle"],
} as const;

interface LedgerRow {
  createdAt: number;
  hash: string;
}

export type RosettaBridgeState = "legacy" | "target";

export interface RosettaBridgeResult {
  changed: boolean;
  sqliteVersion: string;
  state: RosettaBridgeState;
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function tableExists(db: Database.Database, table: string): boolean {
  return (
    db
      .prepare(
        "SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?",
      )
      .get(table) !== undefined
  );
}

function columnNames(db: Database.Database, table: string): Set<string> {
  return new Set(
    db
      // table_info omits generated columns such as legacy events.tool_name.
      .prepare(`PRAGMA table_xinfo(${quoteIdentifier(table)})`)
      .all()
      .map((row) => String((row as { name: unknown }).name)),
  );
}

function requireColumns(
  db: Database.Database,
  table: string,
  expected: readonly string[],
): void {
  if (!tableExists(db, table)) {
    throw new Error(`Rosetta bridge manifest mismatch: missing table ${table}`);
  }
  const actual = columnNames(db, table);
  for (const column of expected) {
    if (!actual.has(column)) {
      throw new Error(
        `Rosetta bridge manifest mismatch: missing ${table}.${column}`,
      );
    }
  }
}

function readLedger(db: Database.Database): Map<number, LedgerRow> {
  if (!tableExists(db, "__drizzle_migrations")) {
    throw new Error("Rosetta bridge requires an existing migration ledger");
  }
  const rows = db
    .prepare(
      "SELECT created_at AS createdAt, hash FROM __drizzle_migrations ORDER BY created_at, id",
    )
    .all() as LedgerRow[];
  const ledger = new Map<number, LedgerRow>();
  for (const row of rows) {
    if (ledger.has(row.createdAt)) {
      throw new Error(
        `Rosetta bridge manifest mismatch: duplicate receipt ${row.createdAt}`,
      );
    }
    ledger.set(row.createdAt, row);
  }
  return ledger;
}

function receiptMatches(
  ledger: ReadonlyMap<number, LedgerRow>,
  receipt: { createdAt: number; hash: string },
): boolean {
  return ledger.get(receipt.createdAt)?.hash === receipt.hash;
}

function requireReceipt(
  ledger: ReadonlyMap<number, LedgerRow>,
  name: string,
  receipt: { createdAt: number; hash: string },
): void {
  const row = ledger.get(receipt.createdAt);
  if (row === undefined) {
    throw new Error(`Rosetta bridge manifest mismatch: missing ${name} receipt`);
  }
  if (row.hash !== receipt.hash) {
    throw new Error(
      `Rosetta bridge manifest mismatch: ${name} receipt hash differs`,
    );
  }
}

function requireNoStagingObjects(db: Database.Database): void {
  const row = db
    .prepare(
      "SELECT name FROM sqlite_schema WHERE name LIKE '_bb_p6r_%' ORDER BY name LIMIT 1",
    )
    .get() as { name: string } | undefined;
  if (row !== undefined) {
    throw new Error(
      `Rosetta bridge refuses recovery/staging object ${row.name}`,
    );
  }
}

function requireIdentitySchema(db: Database.Database): void {
  requireColumns(db, "p6r_actors", [
    "p6r_provider_id",
    "p6r_subject",
    "p6r_handle",
    "p6r_display_name",
    "p6r_image_url",
    "p6r_first_seen_at",
    "p6r_last_seen_at",
  ]);
  requireColumns(db, "p6r_collaborators", [
    "p6r_handle",
    "p6r_display_name",
    "p6r_image_url",
    "p6r_first_seen_at",
    "p6r_last_seen_at",
  ]);
  for (const [table, columns] of Object.entries(IDENTITY_COLUMNS)) {
    requireColumns(db, table, columns);
  }
}

function requireFacetManifest(db: Database.Database): void {
  for (const table of FACET_TABLES) {
    if (!tableExists(db, table)) {
      throw new Error(
        `Rosetta bridge manifest mismatch: missing inert facet table ${table}`,
      );
    }
  }
}

function classify(db: Database.Database): RosettaBridgeState {
  requireNoStagingObjects(db);
  const ledger = readLedger(db);
  const prefixReceipts = readPackagedMigrationReceipts().filter(
    (receipt) => receipt.createdAt < RECEIPTS.upstream0107.createdAt,
  );
  for (const receipt of prefixReceipts) {
    requireReceipt(ledger, receipt.tag, receipt);
  }
  const targetReceipts = [
    RECEIPTS.upstream0107,
    RECEIPTS.upstream0108,
    RECEIPTS.upstream0109,
    RECEIPTS.targetIdentity,
  ];
  const matches = targetReceipts.map((receipt) =>
    receiptMatches(ledger, receipt),
  );
  const hasLegacyIdentity = receiptMatches(ledger, RECEIPTS.legacyIdentity);
  const hasLegacyFacets = receiptMatches(ledger, RECEIPTS.legacyFacets);
  if (hasLegacyIdentity !== hasLegacyFacets) {
    throw new Error("Rosetta bridge refuses a partial historical fork ledger");
  }
  const allowedCreatedAts = new Set([
    ...prefixReceipts.map((receipt) => receipt.createdAt),
    ...targetReceipts.map((receipt) => receipt.createdAt),
    ...(hasLegacyIdentity
      ? [
          RECEIPTS.legacyIdentity.createdAt,
          RECEIPTS.legacyFacets.createdAt,
        ]
      : []),
  ]);
  const unknownReceipt = [...ledger.values()].find(
    (row) => !allowedCreatedAts.has(row.createdAt),
  );
  if (unknownReceipt !== undefined) {
    throw new Error(
      `Rosetta bridge manifest mismatch: unknown receipt ${unknownReceipt.createdAt}`,
    );
  }
  if (matches.every(Boolean)) {
    requireIdentitySchema(db);
    requireColumns(db, "deferred_thread_messages", [
      "id",
      "thread_id",
      "kind",
      "payload",
      "created_at",
    ]);
    requireColumns(db, "plugin_marketplaces", ["stats_json"]);
    if (columnNames(db, "events").has("tool_name")) {
      throw new Error(
        "Rosetta bridge target mismatch: events.tool_name still exists",
      );
    }
    if (hasLegacyIdentity) requireFacetManifest(db);
    return "target";
  }
  if (matches.some(Boolean)) {
    throw new Error("Rosetta bridge refuses a partially adopted target ledger");
  }
  requireReceipt(ledger, "historical identity", RECEIPTS.legacyIdentity);
  requireReceipt(ledger, "historical facets", RECEIPTS.legacyFacets);
  requireIdentitySchema(db);
  requireFacetManifest(db);
  if (!columnNames(db, "events").has("tool_name")) {
    throw new Error(
      "Rosetta bridge legacy mismatch: events.tool_name is already absent",
    );
  }
  return "legacy";
}

function requireNoUnknownToolNameDependencies(db: Database.Database): void {
  const dependencies = db
    .prepare(
      `SELECT type, name, sql
       FROM sqlite_schema
       WHERE sql IS NOT NULL AND lower(sql) LIKE '%tool_name%'
       ORDER BY type, name`,
    )
    .all() as Array<{ name: string; sql: string; type: string }>;
  const allowed = new Set([
    "events",
    "events_tool_call_parent_lookup_idx",
    "events_todo_tool_call_thread_tool_sequence_idx",
  ]);
  const unknown = dependencies.find((entry) => !allowed.has(entry.name));
  if (unknown !== undefined) {
    throw new Error(
      `Rosetta bridge refuses unknown events.tool_name dependency ${unknown.type} ${unknown.name}`,
    );
  }
}

function insertReceipt(
  db: Database.Database,
  receipt: { createdAt: number; hash: string },
): void {
  const existing = db
    .prepare("SELECT hash FROM __drizzle_migrations WHERE created_at = ?")
    .get(receipt.createdAt) as { hash: string } | undefined;
  if (existing !== undefined) {
    throw new Error(
      `Rosetta bridge refuses existing receipt timestamp ${receipt.createdAt}`,
    );
  }
  db.prepare(
    "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
  ).run(receipt.hash, receipt.createdAt);
}

function applyLegacyTransition(db: Database.Database): void {
  requireNoUnknownToolNameDependencies(db);
  db.exec(`
    DROP INDEX IF EXISTS events_tool_call_parent_lookup_idx;
    DROP INDEX IF EXISTS events_todo_tool_call_thread_tool_sequence_idx;
    CREATE INDEX IF NOT EXISTS events_delegating_item_lookup_idx
      ON events (thread_id,item_id,sequence,item_kind)
      WHERE item_kind IN ('toolCall', 'delegation');
    CREATE INDEX IF NOT EXISTS events_plan_steps_thread_sequence_idx
      ON events (thread_id,sequence)
      WHERE (item_kind = 'planSteps' AND type = 'item/completed')
         OR type = 'turn/plan/updated';
    ALTER TABLE events DROP COLUMN tool_name;
    CREATE TABLE deferred_thread_messages (
      id text PRIMARY KEY NOT NULL,
      thread_id text NOT NULL,
      kind text NOT NULL,
      payload text NOT NULL,
      created_at integer NOT NULL,
      FOREIGN KEY (thread_id) REFERENCES threads(id) ON UPDATE no action ON DELETE cascade
    );
    CREATE INDEX deferred_thread_messages_thread_created_idx
      ON deferred_thread_messages (thread_id,created_at,id);
    ALTER TABLE plugin_marketplaces ADD stats_json text;
  `);
  insertReceipt(db, RECEIPTS.upstream0107);
  insertReceipt(db, RECEIPTS.upstream0108);
  insertReceipt(db, RECEIPTS.upstream0109);
  requireIdentitySchema(db);
  insertReceipt(db, RECEIPTS.targetIdentity);
}

/**
 * Performs only the database transition. The caller must hold the canonical
 * path OS lock and prove all writers stopped before this function opens SQLite.
 */
export function runRosettaMigrationBridgeLocked(
  databasePath: string,
): RosettaBridgeResult {
  const inspection = new Database(databasePath, { readonly: true });
  let sqliteVersion: string;
  let initial: RosettaBridgeState;
  try {
    sqliteVersion = String(
      (
        inspection.prepare("SELECT sqlite_version() AS version").get() as {
          version: string;
        }
      ).version,
    );
    initial = classify(inspection);
  } finally {
    inspection.close();
  }
  if (initial === "target") {
    return { changed: false, sqliteVersion, state: "target" };
  }

  const db = new Database(databasePath);
  try {
    db.pragma("busy_timeout = 5000");
    db.pragma("foreign_keys = ON");
    db.pragma("synchronous = FULL");
    db.exec("BEGIN IMMEDIATE");
    try {
      if (classify(db) !== "legacy") {
        throw new Error("Rosetta bridge state changed before transition");
      }
      applyLegacyTransition(db);
      if (classify(db) !== "target") {
        throw new Error("Rosetta bridge failed target verification");
      }
      const foreignKeys = db.pragma("foreign_key_check") as unknown[];
      if (foreignKeys.length !== 0) {
        throw new Error("Rosetta bridge foreign_key_check failed");
      }
      db.exec("COMMIT");
    } catch (error) {
      if (db.inTransaction) db.exec("ROLLBACK");
      throw error;
    }
  } finally {
    db.close();
  }

  const checkpoint = new Database(databasePath);
  try {
    checkpoint.pragma("busy_timeout = 5000");
    const rows = checkpoint.pragma("wal_checkpoint(TRUNCATE)") as Array<{
      busy: number;
      checkpointed: number;
      log: number;
    }>;
    if (rows.length !== 1 || rows[0]?.busy !== 0 || rows[0].log !== 0) {
      throw new Error("Rosetta bridge could not truncate the WAL cleanly");
    }
  } finally {
    checkpoint.close();
  }

  const verification = new Database(databasePath, { readonly: true });
  try {
    if (classify(verification) !== "target") {
      throw new Error("Rosetta bridge read-only target verification failed");
    }
    const integrity = verification.pragma("integrity_check") as Array<{
      integrity_check: string;
    }>;
    if (
      integrity.length !== 1 ||
      integrity[0]?.integrity_check.toLowerCase() !== "ok"
    ) {
      throw new Error("Rosetta bridge integrity_check failed");
    }
  } finally {
    verification.close();
  }
  return { changed: true, sqliteVersion, state: "target" };
}

export const rosettaMigrationReceipts = RECEIPTS;
