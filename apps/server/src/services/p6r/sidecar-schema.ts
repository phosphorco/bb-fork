import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const p6rContributions = sqliteTable(
  "p6r_contributions",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id").notNull(),
    acceptedAt: integer("accepted_at").notNull(),
    acceptedAuthorship: text("accepted_authorship").notNull(),
    initialInput: text("initial_input").notNull(),
    currentProjection: text("current_projection").notNull(),
    latestEditor: text("latest_editor").notNull(),
    copiedFromContributionId: text("copied_from_contribution_id"),
    replacesContributionId: text("replaces_contribution_id"),
    nativeRequestId: text("native_request_id"),
  },
  (table) => [
    index("p6r_contributions_thread_accepted_idx").on(
      table.threadId,
      table.acceptedAt,
      table.id,
    ),
    index("p6r_contributions_native_request_idx").on(
      table.nativeRequestId,
    ),
  ],
);

export const p6rAttempts = sqliteTable(
  "p6r_attempts",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id").notNull(),
    nativeRequestId: text("native_request_id"),
    nativeTurnId: text("native_turn_id"),
    retryOfAttemptId: text("retry_of_attempt_id"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("p6r_attempts_thread_created_idx").on(
      table.threadId,
      table.createdAt,
      table.id,
    ),
    index("p6r_attempts_native_request_idx").on(table.nativeRequestId),
  ],
);

export const p6rAttemptInputs = sqliteTable(
  "p6r_attempt_inputs",
  {
    attemptId: text("attempt_id").notNull(),
    groupIndex: integer("group_index").notNull(),
    sourceIndex: integer("source_index").notNull(),
    sourceKind: text("source_kind").notNull(),
    contributionId: text("contribution_id"),
    snapshot: text("snapshot").notNull(),
  },
  (table) => [
    uniqueIndex("p6r_attempt_inputs_attempt_group_source_idx").on(
      table.attemptId,
      table.groupIndex,
      table.sourceIndex,
    ),
    index("p6r_attempt_inputs_contribution_idx").on(table.contributionId),
  ],
);

export const p6rOperationReceipts = sqliteTable(
  "p6r_operation_receipts",
  {
    operationId: text("operation_id").primaryKey(),
    threadId: text("thread_id").notNull(),
    contributionId: text("contribution_id"),
    nativeRequestId: text("native_request_id"),
    acceptedRequestSequence: integer("accepted_request_sequence"),
    payloadHash: text("payload_hash").notNull(),
    status: text("status").notNull(),
    acceptedAt: integer("accepted_at").notNull(),
    retentionDeadline: integer("retention_deadline").notNull(),
  },
  (table) => [
    uniqueIndex("p6r_operation_receipts_operation_hash_idx").on(
      table.operationId,
      table.payloadHash,
    ),
    index("p6r_operation_receipts_thread_accepted_idx").on(
      table.threadId,
      table.acceptedAt,
    ),
  ],
);

export const p6rPendingQueuedDispatches = sqliteTable(
  "p6r_pending_queued_dispatches",
  {
    queuedMessageId: text("queued_message_id").primaryKey(),
    operationId: text("operation_id").notNull(),
    contributionId: text("contribution_id").notNull(),
    acceptedAuthorship: text("accepted_authorship").notNull(),
    input: text("input").notNull(),
  },
  (table) => [
    uniqueIndex("p6r_pending_queued_dispatches_operation_idx").on(
      table.operationId,
    ),
  ],
);

/**
 * Attribution retained while an ordinary native queue row waits to dispatch.
 * This is deliberately separate from plugin operation receipts: ordinary
 * sends have no caller supplied operation id or external replay contract.
 */
export const p6rPendingNativeWrites = sqliteTable(
  "p6r_pending_native_writes",
  {
    queuedMessageId: text("queued_message_id").primaryKey(),
    threadId: text("thread_id").notNull(),
    acceptedAt: integer("accepted_at").notNull(),
    acceptedAuthorship: text("accepted_authorship").notNull(),
    latestEditor: text("latest_editor").notNull(),
    input: text("input").notNull(),
  },
  (table) => [
    index("p6r_pending_native_writes_thread_idx").on(table.threadId),
  ],
);

export const p6rMetadata = sqliteTable("p6r_metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
