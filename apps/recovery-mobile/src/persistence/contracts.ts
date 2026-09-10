export type SqlBindValue = null | number | string | Uint8Array;

export interface SqlRunResult {
  changes: number;
  lastInsertRowId: number;
}

/** Minimal async surface shared by Expo SQLite and the Node test adapter. */
export interface RecoverySqlDatabase {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: readonly SqlBindValue[]): Promise<SqlRunResult>;
  getFirst<T>(sql: string, params?: readonly SqlBindValue[]): Promise<T | null>;
  getAll<T>(sql: string, params?: readonly SqlBindValue[]): Promise<T[]>;
  transaction<T>(
    operation: (tx: RecoverySqlDatabase) => Promise<T>,
  ): Promise<T>;
  close(): Promise<void>;
}

export type RecoveryOwnerState = "resolved" | "read-only";

export interface RecoveryNamespace {
  namespaceId: string;
  serverProfileKey: string;
  ownerKey: string;
  ownerState: RecoveryOwnerState;
}

export interface ProfileIdentityContext {
  profileId: string;
  serverUrl: string;
  namespaceId: string;
  principalKey: string | null;
  providerId: string | null;
  subject: string | null;
  ownerState: RecoveryOwnerState;
  /** Cached identity may hydrate reads; only live identity may own writes. */
  source: "cached" | "live";
  updatedAt: number;
}

export interface ObservedRecord<T = unknown> {
  namespaceId: string;
  recordKey: string;
  payload: T;
  revision: number;
  updatedAt: number;
}

export type RecoveryOutboxState =
  | "draft"
  | "awaiting-context"
  | "dispatching"
  | "reconciling"
  | "review-required"
  | "cancelled"
  | "delivered";

export interface RecoveryOutboxItem {
  namespaceId: string;
  outboxId: string;
  threadId: string;
  body: string;
  state: RecoveryOutboxState;
  createdAt: number;
  updatedAt: number;
}

export type AttachmentPayloadState = "staging" | "complete" | "unavailable";

export interface AttachmentPayload {
  namespaceId: string;
  attachmentId: string;
  outboxId: string;
  state: AttachmentPayloadState;
  stagingPath: string | null;
  finalPath: string | null;
  sha256: string | null;
  byteCount: number;
}

export interface RecoveryPersistenceDiagnostics {
  journalMode: string;
  integrity: string;
  schemaVersion: number;
}
