import type { RecoverySqlDatabase } from "./contracts";

export const RECOVERY_SCHEMA_VERSION = 4;

const MIGRATIONS = [
  {
    version: 1,
    sql: `
      CREATE TABLE namespaces (
        namespace_id TEXT PRIMARY KEY NOT NULL,
        server_profile_key TEXT NOT NULL,
        owner_key TEXT NOT NULL,
        owner_state TEXT NOT NULL CHECK(owner_state IN ('resolved', 'read-only')),
        UNIQUE(server_profile_key, owner_key)
      );

      CREATE TABLE observed_records (
        namespace_id TEXT NOT NULL REFERENCES namespaces(namespace_id) ON DELETE CASCADE,
        record_key TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        revision INTEGER NOT NULL CHECK(revision >= 0),
        updated_at INTEGER NOT NULL,
        PRIMARY KEY(namespace_id, record_key)
      );

      CREATE TABLE outbox_items (
        namespace_id TEXT NOT NULL REFERENCES namespaces(namespace_id) ON DELETE RESTRICT,
        outbox_id TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        body TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN (
          'draft', 'awaiting-context', 'dispatching', 'reconciling',
          'review-required', 'cancelled', 'delivered'
        )),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY(namespace_id, outbox_id)
      );
    `,
  },
  {
    version: 2,
    sql: `
      CREATE TABLE attachment_payloads (
        namespace_id TEXT NOT NULL,
        attachment_id TEXT NOT NULL,
        outbox_id TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('staging', 'complete', 'unavailable')),
        staging_path TEXT,
        final_path TEXT,
        sha256 TEXT,
        byte_count INTEGER NOT NULL CHECK(byte_count >= 0),
        PRIMARY KEY(namespace_id, attachment_id),
        FOREIGN KEY(namespace_id, outbox_id)
          REFERENCES outbox_items(namespace_id, outbox_id) ON DELETE CASCADE
      );

      CREATE INDEX attachment_payloads_outbox_idx
        ON attachment_payloads(namespace_id, outbox_id);
    `,
  },
  {
    version: 3,
    sql: `
      CREATE TABLE profile_identity_contexts (
        profile_id TEXT PRIMARY KEY NOT NULL,
        server_url TEXT NOT NULL,
        namespace_id TEXT NOT NULL REFERENCES namespaces(namespace_id) ON DELETE RESTRICT,
        principal_key TEXT,
        provider_id TEXT,
        subject TEXT,
        owner_state TEXT NOT NULL CHECK(owner_state IN ('resolved', 'read-only')),
        updated_at INTEGER NOT NULL
      );
    `,
  },
  {
    version: 4,
    sql: `
      CREATE TABLE profile_identity_contexts_v4 (
        profile_id TEXT NOT NULL,
        server_url TEXT NOT NULL,
        namespace_id TEXT NOT NULL REFERENCES namespaces(namespace_id) ON DELETE RESTRICT,
        principal_key TEXT,
        provider_id TEXT,
        subject TEXT,
        owner_state TEXT NOT NULL CHECK(owner_state IN ('resolved', 'read-only')),
        updated_at INTEGER NOT NULL,
        PRIMARY KEY(profile_id, server_url)
      );

      INSERT INTO profile_identity_contexts_v4 (
        profile_id, server_url, namespace_id, principal_key,
        provider_id, subject, owner_state, updated_at
      )
      SELECT
        profile_id, server_url, namespace_id, principal_key,
        provider_id, subject, owner_state, updated_at
      FROM profile_identity_contexts;

      DROP TABLE profile_identity_contexts;
      ALTER TABLE profile_identity_contexts_v4 RENAME TO profile_identity_contexts;
    `,
  },
] as const;

interface UserVersionRow {
  user_version: number;
}

export interface MigrationHooks {
  afterDdl?: (version: number, tx: RecoverySqlDatabase) => Promise<void>;
}

export async function readRecoverySchemaVersion(
  db: RecoverySqlDatabase,
): Promise<number> {
  const row = await db.getFirst<UserVersionRow>("PRAGMA user_version");
  return row?.user_version ?? 0;
}

export async function migrateRecoveryDatabase(
  db: RecoverySqlDatabase,
  hooks: MigrationHooks = {},
): Promise<number> {
  let current = await readRecoverySchemaVersion(db);
  if (current > RECOVERY_SCHEMA_VERSION) {
    throw new Error(
      `Recovery database schema ${current} is newer than supported ${RECOVERY_SCHEMA_VERSION}`,
    );
  }

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    await db.transaction(async (tx) => {
      await tx.exec(migration.sql);
      await hooks.afterDdl?.(migration.version, tx);
      await tx.exec(`PRAGMA user_version = ${migration.version}`);
    });
    current = migration.version;
  }
  return current;
}
