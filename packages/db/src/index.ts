export { createConnection } from "./connection.js";
export type {
  DbConnection,
  DbQueryConnection,
  DbTransaction,
  SlowDbQueryLogger,
  SlowDbQueryLogFields,
} from "./connection.js";

export * from "./schema.js";
export {
  createQueuedThreadMessageId,
  createEnvironmentId,
  createEventId,
  createHostDaemonSessionId,
  createHostId,
  createProjectId,
  createPromptHistoryEntryId,
  createProjectSourceId,
  createThreadId,
  createThreadProvisioningId,
} from "./ids.js";

export { migrate, readPackagedMigrationReceipts } from "./migrate.js";
export {
  isSqliteForeignKeyConstraint,
  isSqliteUniqueConstraintOnColumns,
} from "./sqlite-errors.js";
export type {
  MigrationWarningLogger,
  PackagedMigrationReceipt,
} from "./migrate.js";
export {
  rosettaMigrationReceipts,
  runRosettaMigrationBridgeLocked,
} from "./rosetta-migration-bridge.js";
export type {
  RosettaBridgeResult,
  RosettaBridgeState,
} from "./rosetta-migration-bridge.js";
export {
  deriveStoredEventItemFields,
  deriveStoredEventItemFieldsFromSource,
} from "./stored-event-item-fields.js";
export { noopNotifier } from "./notifier.js";
export type { DbNotifier } from "./notifier.js";

export * from "./data/index.js";
