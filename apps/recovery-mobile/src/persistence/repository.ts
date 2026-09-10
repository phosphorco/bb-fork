import type {
  AttachmentPayload,
  ObservedRecord,
  ProfileIdentityContext,
  RecoveryNamespace,
  RecoveryOutboxItem,
  RecoveryPersistenceDiagnostics,
  RecoverySqlDatabase,
} from "./contracts";
import {
  migrateRecoveryDatabase,
  readRecoverySchemaVersion,
} from "./migrations";

interface JournalModeRow {
  journal_mode: string;
}

interface IntegrityRow {
  integrity_check: string;
}

interface ObservedRecordRow {
  namespace_id: string;
  record_key: string;
  payload_json: string;
  revision: number;
  updated_at: number;
}

interface OutboxRow {
  namespace_id: string;
  outbox_id: string;
  thread_id: string;
  body: string;
  state: RecoveryOutboxItem["state"];
  created_at: number;
  updated_at: number;
}

interface AttachmentRow {
  namespace_id: string;
  attachment_id: string;
  outbox_id: string;
  state: AttachmentPayload["state"];
  staging_path: string | null;
  final_path: string | null;
  sha256: string | null;
  byte_count: number;
}

interface ProfileIdentityContextRow {
  profile_id: string;
  server_url: string;
  namespace_id: string;
  principal_key: string | null;
  provider_id: string | null;
  subject: string | null;
  owner_state: ProfileIdentityContext["ownerState"];
  updated_at: number;
}

type RecordListener = () => void;

function observationKey(namespaceId: string, recordKey: string): string {
  return JSON.stringify([namespaceId, recordKey]);
}

function decodeObservedRecord<T>(row: ObservedRecordRow): ObservedRecord<T> {
  return {
    namespaceId: row.namespace_id,
    recordKey: row.record_key,
    payload: JSON.parse(row.payload_json) as T,
    revision: row.revision,
    updatedAt: row.updated_at,
  };
}

function decodeOutbox(row: OutboxRow): RecoveryOutboxItem {
  return {
    namespaceId: row.namespace_id,
    outboxId: row.outbox_id,
    threadId: row.thread_id,
    body: row.body,
    state: row.state,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function decodeAttachment(row: AttachmentRow): AttachmentPayload {
  return {
    namespaceId: row.namespace_id,
    attachmentId: row.attachment_id,
    outboxId: row.outbox_id,
    state: row.state,
    stagingPath: row.staging_path,
    finalPath: row.final_path,
    sha256: row.sha256,
    byteCount: row.byte_count,
  };
}

function decodeIdentityContext(
  row: ProfileIdentityContextRow,
): ProfileIdentityContext {
  return {
    profileId: row.profile_id,
    serverUrl: row.server_url,
    namespaceId: row.namespace_id,
    principalKey: row.principal_key,
    providerId: row.provider_id,
    subject: row.subject,
    ownerState: row.owner_state,
    source: "cached",
    updatedAt: row.updated_at,
  };
}

export class RecoveryRepository {
  private readonly listeners = new Map<string, Set<RecordListener>>();

  constructor(private readonly db: RecoverySqlDatabase) {}

  async initialize(): Promise<RecoveryPersistenceDiagnostics> {
    await this.db.exec("PRAGMA foreign_keys = ON");
    const journal = await this.db.getFirst<JournalModeRow>(
      "PRAGMA journal_mode = WAL",
    );
    const schemaVersion = await migrateRecoveryDatabase(this.db);
    return {
      journalMode: journal?.journal_mode ?? "unknown",
      integrity: "not-checked",
      schemaVersion,
    };
  }

  /** Explicit diagnostic; never put a full-database scan on the boot path. */
  async checkIntegrity(): Promise<string> {
    const integrity = await this.db.getFirst<IntegrityRow>(
      "PRAGMA integrity_check",
    );
    return integrity?.integrity_check ?? "missing";
  }

  async ensureNamespace(namespace: RecoveryNamespace): Promise<void> {
    await this.db.run(
      `INSERT INTO namespaces (
        namespace_id, server_profile_key, owner_key, owner_state
      ) VALUES (?, ?, ?, ?)
      ON CONFLICT(namespace_id) DO UPDATE SET
        server_profile_key = excluded.server_profile_key,
        owner_key = excluded.owner_key,
        owner_state = excluded.owner_state`,
      [
        namespace.namespaceId,
        namespace.serverProfileKey,
        namespace.ownerKey,
        namespace.ownerState,
      ],
    );
  }

  async putProfileIdentityContext(
    context: ProfileIdentityContext,
    options: { serverProfileKey: string },
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.run(
        `INSERT INTO namespaces (
          namespace_id, server_profile_key, owner_key, owner_state
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(namespace_id) DO UPDATE SET
          server_profile_key = excluded.server_profile_key,
          owner_key = excluded.owner_key,
          owner_state = excluded.owner_state`,
        [
          context.namespaceId,
          options.serverProfileKey,
          context.principalKey ?? "read-only",
          context.ownerState,
        ],
      );
      await tx.run(
        `INSERT INTO profile_identity_contexts (
          profile_id, server_url, namespace_id, principal_key,
          provider_id, subject, owner_state, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(profile_id, server_url) DO UPDATE SET
          namespace_id = excluded.namespace_id,
          principal_key = excluded.principal_key,
          provider_id = excluded.provider_id,
          subject = excluded.subject,
          owner_state = excluded.owner_state,
          updated_at = excluded.updated_at
        WHERE excluded.updated_at >= profile_identity_contexts.updated_at`,
        [
          context.profileId,
          context.serverUrl,
          context.namespaceId,
          context.principalKey,
          context.providerId,
          context.subject,
          context.ownerState,
          context.updatedAt,
        ],
      );
    });
  }

  async getProfileIdentityContext(
    profileId: string,
    serverUrl: string,
  ): Promise<ProfileIdentityContext | null> {
    const row = await this.db.getFirst<ProfileIdentityContextRow>(
      `SELECT profile_id, server_url, namespace_id, principal_key,
              provider_id, subject, owner_state, updated_at
       FROM profile_identity_contexts
       WHERE profile_id = ? AND server_url = ?`,
      [profileId, serverUrl],
    );
    return row ? decodeIdentityContext(row) : null;
  }

  async putObservedRecord<T>(record: ObservedRecord<T>): Promise<void> {
    await this.putObservedRecords([record]);
  }

  /** Commit a related cache snapshot atomically, then publish keyed updates. */
  async putObservedRecords(records: readonly ObservedRecord[]): Promise<void> {
    if (records.length === 0) return;
    const changedKeys = new Set<string>();
    await this.db.transaction(async (tx) => {
      for (const record of records) {
        const result = await tx.run(
          `INSERT INTO observed_records (
            namespace_id, record_key, payload_json, revision, updated_at
          ) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(namespace_id, record_key) DO UPDATE SET
            payload_json = excluded.payload_json,
            revision = excluded.revision,
            updated_at = excluded.updated_at
          WHERE excluded.revision > observed_records.revision
             OR (
               excluded.revision = observed_records.revision
               AND excluded.updated_at >= observed_records.updated_at
             )`,
          [
            record.namespaceId,
            record.recordKey,
            JSON.stringify(record.payload),
            record.revision,
            record.updatedAt,
          ],
        );
        if (result.changes > 0) {
          changedKeys.add(observationKey(record.namespaceId, record.recordKey));
        }
      }
    });
    for (const key of changedKeys) {
      for (const listener of this.listeners.get(key) ?? []) {
        try {
          listener();
        } catch {
          // A UI observer cannot turn a successful durable commit into failure.
        }
      }
    }
  }

  async getObservedRecord<T>(
    namespaceId: string,
    recordKey: string,
  ): Promise<ObservedRecord<T> | null> {
    const row = await this.db.getFirst<ObservedRecordRow>(
      `SELECT namespace_id, record_key, payload_json, revision, updated_at
       FROM observed_records
       WHERE namespace_id = ? AND record_key = ?`,
      [namespaceId, recordKey],
    );
    return row ? decodeObservedRecord<T>(row) : null;
  }

  subscribeObservedRecord(
    namespaceId: string,
    recordKey: string,
    listener: RecordListener,
  ): () => void {
    const key = observationKey(namespaceId, recordKey);
    const listeners = this.listeners.get(key) ?? new Set<RecordListener>();
    listeners.add(listener);
    this.listeners.set(key, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(key);
    };
  }

  async putOutboxItem(item: RecoveryOutboxItem): Promise<void> {
    await this.db.run(
      `INSERT INTO outbox_items (
        namespace_id, outbox_id, thread_id, body, state, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(namespace_id, outbox_id) DO UPDATE SET
        thread_id = excluded.thread_id,
        body = excluded.body,
        state = excluded.state,
        updated_at = excluded.updated_at`,
      [
        item.namespaceId,
        item.outboxId,
        item.threadId,
        item.body,
        item.state,
        item.createdAt,
        item.updatedAt,
      ],
    );
  }

  async getOutboxItem(
    namespaceId: string,
    outboxId: string,
  ): Promise<RecoveryOutboxItem | null> {
    const row = await this.db.getFirst<OutboxRow>(
      `SELECT namespace_id, outbox_id, thread_id, body, state, created_at, updated_at
       FROM outbox_items
       WHERE namespace_id = ? AND outbox_id = ?`,
      [namespaceId, outboxId],
    );
    return row ? decodeOutbox(row) : null;
  }

  async putAttachmentPayload(payload: AttachmentPayload): Promise<void> {
    await this.db.run(
      `INSERT INTO attachment_payloads (
        namespace_id, attachment_id, outbox_id, state,
        staging_path, final_path, sha256, byte_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(namespace_id, attachment_id) DO UPDATE SET
        outbox_id = excluded.outbox_id,
        state = excluded.state,
        staging_path = excluded.staging_path,
        final_path = excluded.final_path,
        sha256 = excluded.sha256,
        byte_count = excluded.byte_count`,
      [
        payload.namespaceId,
        payload.attachmentId,
        payload.outboxId,
        payload.state,
        payload.stagingPath,
        payload.finalPath,
        payload.sha256,
        payload.byteCount,
      ],
    );
  }

  async listAttachmentPayloads(): Promise<AttachmentPayload[]> {
    const rows = await this.db.getAll<AttachmentRow>(
      `SELECT namespace_id, attachment_id, outbox_id, state,
              staging_path, final_path, sha256, byte_count
       FROM attachment_payloads`,
    );
    return rows.map(decodeAttachment);
  }

  async markAttachmentUnavailable(
    namespaceId: string,
    attachmentId: string,
  ): Promise<void> {
    await this.db.run(
      `UPDATE attachment_payloads
       SET state = 'unavailable'
       WHERE namespace_id = ? AND attachment_id = ?`,
      [namespaceId, attachmentId],
    );
  }

  async schemaVersion(): Promise<number> {
    return readRecoverySchemaVersion(this.db);
  }

  close(): Promise<void> {
    this.listeners.clear();
    return this.db.close();
  }
}
