import { randomUUID } from "node:crypto";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { JsonValue } from "@bb/domain";
import { events, type DbQueryConnection } from "@bb/db";
import {
  p6rAttemptInputs,
  p6rAttempts,
  p6rContributions,
  p6rOperationReceipts,
  p6rMetadata,
  p6rPendingQueuedDispatches,
  p6rPendingNativeWrites,
} from "./sidecar-schema.js";
import type { P6rOrigin } from "./identity-protocol.js";
import type { P6rValidity } from "./invocation-registry.js";

export interface P6rContributionDraft {
  readonly acceptedAt: number;
  readonly acceptedAuthorship: JsonValue;
  readonly copiedFromContributionId?: string;
  readonly currentProjection: JsonValue;
  readonly id: string;
  readonly initialInput: JsonValue;
  readonly latestEditor: JsonValue;
  readonly nativeRequestId?: string;
  readonly replacesContributionId?: string;
  readonly threadId: string;
}

export interface P6rAttemptInputDraft {
  readonly contributionId?: string;
  readonly groupIndex: number;
  readonly snapshot: JsonValue;
  readonly sourceIndex: number;
  readonly sourceKind: "contribution" | "generated" | "interaction";
}

export interface P6rAttemptDraft {
  readonly createdAt: number;
  readonly id: string;
  readonly inputs: readonly P6rAttemptInputDraft[];
  readonly nativeRequestId?: string;
  readonly nativeTurnId?: string;
  readonly retryOfAttemptId?: string;
  readonly threadId: string;
}

export type P6rNativeOriginEvidence = JsonValue | P6rOrigin;

export interface P6rNativeWriteOrigin {
  /**
   * A frozen human/external actor snapshot, or the public P6rOrigin shape for
   * explicit system/unknown/agent evidence.  The persisted row keeps the
   * legacy actor snapshot shape for people and external identities.
   */
  readonly acceptedAuthorship: P6rNativeOriginEvidence;
  readonly validate: () => P6rValidity;
}

export interface P6rNativeWriteDraft {
  readonly acceptedAt: number;
  readonly attemptId: string;
  readonly contributionIds: readonly string[];
  readonly inputGroups: readonly JsonValue[];
  readonly nativeRequestId: string;
  readonly threadId: string;
}

function persistedNativeOrigin(
  origin: P6rNativeOriginEvidence,
): JsonValue {
  if (origin === null || typeof origin !== "object" || Array.isArray(origin)) {
    return origin as JsonValue;
  }

  const candidate = origin as P6rOrigin;
  switch (candidate.kind) {
    case "person":
    case "external":
      return candidate.actor as unknown as JsonValue;
    case "agent":
      return { agentId: candidate.agentId, kind: "agent" };
    case "system":
      return { kind: "system", reason: candidate.reason };
    case "unknown":
      return { kind: "unknown", reason: candidate.reason };
    default:
      return origin as JsonValue;
  }
}

export function recordP6rNativeWriteInTransaction(
  db: DbQueryConnection,
  origin: P6rNativeWriteOrigin | null,
  draft: P6rNativeWriteDraft,
): void {
  if (origin === null) return;
  const validity = origin.validate();
  if (!validity.ok) throw new Error(`P6r acceptance rejected: ${validity.code}`);
  if (draft.contributionIds.length !== draft.inputGroups.length) {
    throw new Error("P6r input groups and contributions are not aligned");
  }
  const acceptedAuthorship = serialize(
    persistedNativeOrigin(origin.acceptedAuthorship),
  );
  for (const [groupIndex, input] of draft.inputGroups.entries()) {
    const contributionId = draft.contributionIds[groupIndex]!;
    db.insert(p6rContributions).values({
      id: contributionId,
      threadId: draft.threadId,
      acceptedAt: draft.acceptedAt,
      acceptedAuthorship,
      initialInput: serialize(input),
      currentProjection: serialize(input),
      latestEditor: acceptedAuthorship,
      copiedFromContributionId: null,
      replacesContributionId: null,
      nativeRequestId: draft.nativeRequestId,
    }).run();
  }
  db.insert(p6rAttempts).values({
    id: draft.attemptId,
    threadId: draft.threadId,
    nativeRequestId: draft.nativeRequestId,
    nativeTurnId: null,
    retryOfAttemptId: null,
    createdAt: draft.acceptedAt,
  }).run();
  for (const [groupIndex, input] of draft.inputGroups.entries()) {
    db.insert(p6rAttemptInputs).values({
      attemptId: draft.attemptId,
      groupIndex,
      sourceIndex: 0,
      sourceKind: "contribution",
      contributionId: draft.contributionIds[groupIndex]!,
      snapshot: serialize(input),
    }).run();
  }
}

export interface P6rNativeQueuedWriteReservation {
  readonly acceptedAt: number;
  readonly acceptedAuthorship: JsonValue;
  readonly input: JsonValue;
  readonly latestEditor: JsonValue;
  readonly threadId: string;
}

/**
 * Persists request-scoped attribution with an ordinary queued row. The
 * original request scope is intentionally not consulted at drain time: this
 * is the durable accepted evidence that survived the queue wait.
 */
export function reserveP6rNativeQueuedWriteInTransaction(
  db: DbQueryConnection,
  input: {
    readonly acceptedAt: number;
    readonly input: JsonValue;
    readonly origin: P6rNativeWriteOrigin | null;
    readonly queuedMessageId: string;
    readonly threadId: string;
  },
): boolean {
  if (input.origin === null) return false;
  const validity = input.origin.validate();
  if (!validity.ok) {
    throw new Error(`P6r acceptance rejected: ${validity.code}`);
  }
  const existing = db
    .select()
    .from(p6rPendingNativeWrites)
    .where(eq(p6rPendingNativeWrites.queuedMessageId, input.queuedMessageId))
    .get();
  if (existing !== undefined) {
    throw new Error(
      `P6r native attribution already exists for queued message ${input.queuedMessageId}`,
    );
  }
  const authorship = serialize(persistedNativeOrigin(input.origin.acceptedAuthorship));
  db.insert(p6rPendingNativeWrites)
    .values({
      acceptedAt: input.acceptedAt,
      acceptedAuthorship: authorship,
      input: serialize(input.input),
      latestEditor: authorship,
      queuedMessageId: input.queuedMessageId,
      threadId: input.threadId,
    })
    .run();
  bumpHistoryRevision(db);
  return true;
}

export function p6rNativeQueuedWriteReservation(
  db: DbQueryConnection,
  queuedMessageId: string,
): P6rNativeQueuedWriteReservation | null {
  const row = db
    .select()
    .from(p6rPendingNativeWrites)
    .where(eq(p6rPendingNativeWrites.queuedMessageId, queuedMessageId))
    .get();
  if (row === undefined) return null;
  return {
    acceptedAt: row.acceptedAt,
    acceptedAuthorship: parseJson(row.acceptedAuthorship),
    input: parseJson(row.input),
    latestEditor: parseJson(row.latestEditor),
    threadId: row.threadId,
  };
}

/**
 * An edit never changes the accepted author.  A request with no trustworthy
 * origin remains an explicit unknown editor rather than borrowing ambient
 * identity from the original queue creator.
 */
export function updateP6rNativeQueuedWriteInTransaction(
  db: DbQueryConnection,
  input: {
    readonly editor: P6rNativeWriteOrigin | null;
    readonly input: JsonValue;
    readonly queuedMessageId: string;
  },
): boolean {
  const existing = p6rNativeQueuedWriteReservation(db, input.queuedMessageId);
  if (existing === null) return false;
  if (input.editor !== null) {
    const validity = input.editor.validate();
    if (!validity.ok) {
      throw new Error(`P6r acceptance rejected: ${validity.code}`);
    }
  }
  const latestEditor =
    input.editor === null
      ? { kind: "unknown", reason: "missing-source" }
      : persistedNativeOrigin(input.editor.acceptedAuthorship);
  db.update(p6rPendingNativeWrites)
    .set({
      input: serialize(input.input),
      latestEditor: serialize(latestEditor),
    })
    .where(eq(p6rPendingNativeWrites.queuedMessageId, input.queuedMessageId))
    .run();
  bumpHistoryRevision(db);
  return true;
}

export function deleteP6rNativeQueuedWriteInTransaction(
  db: DbQueryConnection,
  queuedMessageId: string,
): boolean {
  const result = db
    .delete(p6rPendingNativeWrites)
    .where(eq(p6rPendingNativeWrites.queuedMessageId, queuedMessageId))
    .run();
  if (result.changes === 0) return false;
  bumpHistoryRevision(db);
  return true;
}

/**
 * Promotes the accepted queue evidence into the one final native request. A
 * group without retained attribution remains an explicit null contribution,
 * so a mixed ordinary queue cannot look wholly attributable.
 */
export function promoteP6rNativeQueuedWritesInTransaction(
  db: DbQueryConnection,
  input: {
    readonly attemptId: string;
    readonly inputGroups: readonly JsonValue[];
    readonly nativeRequestId: string;
    readonly queuedMessageIds: readonly string[];
    readonly threadId: string;
  },
): boolean {
  if (input.queuedMessageIds.length !== input.inputGroups.length) {
    throw new Error("P6r queued native input groups are not aligned");
  }
  const reservations = input.queuedMessageIds.map((queuedMessageId) =>
    p6rNativeQueuedWriteReservation(db, queuedMessageId),
  );
  if (reservations.every((reservation) => reservation === null)) return false;
  for (const reservation of reservations) {
    if (reservation !== null && reservation.threadId !== input.threadId) {
      throw new Error("P6r queued native attribution thread mismatch");
    }
  }
  db.insert(p6rAttempts)
    .values({
      createdAt: Date.now(),
      id: input.attemptId,
      nativeRequestId: input.nativeRequestId,
      nativeTurnId: null,
      retryOfAttemptId: null,
      threadId: input.threadId,
    })
    .run();
  for (const [groupIndex, group] of input.inputGroups.entries()) {
    const reservation = reservations[groupIndex]!;
    const contributionId =
      reservation === null
        ? null
        : `${input.attemptId}:contribution:${groupIndex}`;
    if (reservation !== null) {
      db.insert(p6rContributions)
        .values({
          acceptedAt: reservation.acceptedAt,
          acceptedAuthorship: serialize(reservation.acceptedAuthorship),
          copiedFromContributionId: null,
          currentProjection: serialize(group),
          id: contributionId!,
          initialInput: serialize(reservation.input),
          latestEditor: serialize(reservation.latestEditor),
          nativeRequestId: input.nativeRequestId,
          replacesContributionId: null,
          threadId: input.threadId,
        })
        .run();
    }
    db.insert(p6rAttemptInputs)
      .values({
        attemptId: input.attemptId,
        contributionId,
        groupIndex,
        snapshot: serialize(group),
        sourceIndex: 0,
        sourceKind: "contribution",
      })
      .run();
  }
  for (const queuedMessageId of input.queuedMessageIds) {
    db.delete(p6rPendingNativeWrites)
      .where(eq(p6rPendingNativeWrites.queuedMessageId, queuedMessageId))
      .run();
  }
  bumpHistoryRevision(db);
  return true;
}

export interface P6rAcceptanceDraft {
  readonly assertLive: () => P6rValidity;
  readonly attempt?: P6rAttemptDraft;
  readonly contribution: P6rContributionDraft;
  readonly operationId: string;
  readonly operationNamespace: string;
  readonly payloadHash: string;
  readonly receipt: {
    readonly acceptedAt: number;
    readonly acceptedRequestSequence?: number;
    readonly nativeRequestId?: string;
    readonly retentionDeadline: number;
    readonly threadId: string;
  };
}

export interface P6rOperationReceipt {
  readonly acceptedAt: number;
  readonly acceptedRequestSequence: number | null;
  readonly contributionId: string | null;
  readonly nativeRequestId: string | null;
  readonly operationId: string;
  readonly operationNamespace: string;
  readonly payloadHash: string;
  readonly retentionDeadline: number;
  readonly status: "accepted" | "indeterminate" | "pending" | "rejected";
  readonly threadId: string;
}

export interface P6rQueuedOperationReservation {
  readonly acceptedAuthorship: JsonValue;
  readonly contributionId: string;
  readonly input: JsonValue;
  readonly receipt: P6rOperationReceipt;
}

export type P6rAcceptanceResult =
  | { readonly created: false; readonly receipt: P6rOperationReceipt }
  | { readonly created: true; readonly receipt: P6rOperationReceipt };

export interface P6rStoredContribution {
  readonly acceptedAt: number;
  readonly acceptedAuthorship: JsonValue;
  readonly currentProjection: JsonValue;
  readonly id: string;
  readonly initialInput: JsonValue;
  readonly latestEditor: JsonValue;
  readonly nativeRequestId: string | null;
  readonly replacesContributionId: string | null;
  readonly threadId: string;
}

export interface P6rStoredAttemptInput {
  readonly contributionId: string | null;
  readonly groupIndex: number;
  readonly snapshot: JsonValue;
  readonly sourceIndex: number;
  readonly sourceKind: "contribution" | "generated" | "interaction";
}

export interface P6rStoredAttempt {
  readonly createdAt: number;
  readonly id: string;
  readonly inputs: readonly P6rStoredAttemptInput[];
  readonly nativeRequestId: string | null;
  readonly nativeTurnId: string | null;
  readonly threadId: string;
}

function serialize(value: JsonValue): string {
  return JSON.stringify(value);
}

function storageOperationId(operationNamespace: string, operationId: string): string {
  return tupleKey(operationNamespace, operationId);
}
function storageRecordId(operationNamespace: string, id: string): string {
  return tupleKey(operationNamespace, id);
}
function tupleKey(...parts: readonly string[]): string {
  return parts.map((part) => `${part.length}:${part}`).join("");
}

function tupleParts(value: string): readonly string[] | null {
  const parts: string[] = [];
  let cursor = 0;
  while (cursor < value.length) {
    const separator = value.indexOf(":", cursor);
    if (separator < cursor) return null;
    const lengthText = value.slice(cursor, separator);
    if (!/^(0|[1-9][0-9]*)$/.test(lengthText)) return null;
    const length = Number(lengthText);
    const start = separator + 1;
    const end = start + length;
    if (!Number.isSafeInteger(length) || end > value.length) return null;
    parts.push(value.slice(start, end));
    cursor = end;
  }
  return parts;
}

function logicalRecordId(operationNamespace: string, storedId: string): string {
  const parts = tupleParts(storedId);
  if (parts === null || parts.length !== 2 || parts[0] !== operationNamespace) {
    throw new Error("Invalid P6r namespaced record identifier");
  }
  return parts[1]!;
}

const instanceNamespaceKey = "instance-namespace-v1";
const historyRevisionKey = "history-revision-v1";

function parseJson(value: string): JsonValue {
  const parsed: unknown = JSON.parse(value);
  return parsed as JsonValue;
}

function logicalStoredId(value: string | null): string | null {
  if (value === null) return null;
  const parts = tupleParts(value);
  return parts !== null && parts.length === 2 ? parts[1]! : null;
}

function historyRevision(db: DbQueryConnection): string {
  return db
    .select()
    .from(p6rMetadata)
    .where(eq(p6rMetadata.key, historyRevisionKey))
    .get()?.value ?? "0";
}

function bumpHistoryRevision(db: DbQueryConnection): void {
  const current = Number(historyRevision(db));
  const value = String(Number.isSafeInteger(current) && current >= 0 ? current + 1 : 1);
  db.insert(p6rMetadata)
    .values({ key: historyRevisionKey, value })
    .onConflictDoUpdate({ target: p6rMetadata.key, set: { value } })
    .run();
}

export function initializeP6rInstanceNamespace(
  db: DbQueryConnection,
  generate: () => string = randomUUID,
): string {
  const existing = db
    .select()
    .from(p6rMetadata)
    .where(eq(p6rMetadata.key, instanceNamespaceKey))
    .get();
  if (existing !== undefined) return existing.value;
  const value = `p6r:${generate()}`;
  db.insert(p6rMetadata)
    .values({ key: instanceNamespaceKey, value })
    .onConflictDoNothing()
    .run();
  const stored = db
    .select()
    .from(p6rMetadata)
    .where(eq(p6rMetadata.key, instanceNamespaceKey))
    .get();
  if (stored === undefined) {
    throw new Error("P6r instance namespace initialization failed");
  }
  return stored.value;
}

export function getP6rHistoryRevision(db: DbQueryConnection): string {
  return historyRevision(db);
}

export function findP6rNativeRequestForEvent(
  db: DbQueryConnection,
  threadId: string,
  eventId: string,
): string | null {
  const event = db.select().from(events).where(and(
    eq(events.id, eventId),
    eq(events.threadId, threadId),
  )).get();
  if (event === undefined) return null;
  const receipts = db.select().from(p6rOperationReceipts).where(and(
    eq(p6rOperationReceipts.threadId, threadId),
    eq(p6rOperationReceipts.acceptedRequestSequence, event.sequence),
  )).all();
  return receipts.length === 1 ? receipts[0]!.nativeRequestId : null;
}

function storedContribution(
  row: typeof p6rContributions.$inferSelect,
): P6rStoredContribution | null {
  const id = logicalStoredId(row.id);
  if (id === null) return null;
  return {
    acceptedAt: row.acceptedAt,
    acceptedAuthorship: parseJson(row.acceptedAuthorship),
    currentProjection: parseJson(row.currentProjection),
    id,
    initialInput: parseJson(row.initialInput),
    latestEditor: parseJson(row.latestEditor),
    nativeRequestId: row.nativeRequestId,
    replacesContributionId: logicalStoredId(row.replacesContributionId),
    threadId: row.threadId,
  };
}

export function listP6rContributions(
  db: DbQueryConnection,
  _operationNamespace: string,
  input: { readonly nativeRequestId?: string; readonly references?: readonly { readonly contributionId: string; readonly threadId: string }[]; readonly threadId?: string },
): readonly P6rStoredContribution[] {
  const rows = input.references === undefined
    ? db.select().from(p6rContributions).where(and(
        input.threadId === undefined ? undefined : eq(p6rContributions.threadId, input.threadId),
        input.nativeRequestId === undefined ? undefined : eq(p6rContributions.nativeRequestId, input.nativeRequestId),
      )).all()
    : db.select().from(p6rContributions).all();
  const values = rows
    .map((row) => storedContribution(row))
    .filter((row): row is P6rStoredContribution => row !== null)
    .filter((row) => input.references === undefined || input.references.some((reference) => reference.threadId === row.threadId && reference.contributionId === row.id));
  const replaced = new Set(
    db.select().from(p6rContributions).all()
      .map((row) => storedContribution(row))
      .filter((row): row is P6rStoredContribution => row !== null)
      .flatMap((row) => row.replacesContributionId === null ? [] : [`${row.threadId}\u0000${row.replacesContributionId}`]),
  );
  return values
    .filter((row) => !replaced.has(`${row.threadId}\u0000${row.id}`))
    .sort((left, right) => left.acceptedAt - right.acceptedAt || left.id.localeCompare(right.id));
}

function storedAttempt(
  db: DbQueryConnection,
  row: typeof p6rAttempts.$inferSelect,
): P6rStoredAttempt | null {
  const id = logicalStoredId(row.id);
  if (id === null) return null;
  const inputs = db.select().from(p6rAttemptInputs)
    .where(eq(p6rAttemptInputs.attemptId, row.id)).all()
    .map((input) => ({
      contributionId: logicalStoredId(input.contributionId),
      groupIndex: input.groupIndex,
      snapshot: parseJson(input.snapshot),
      sourceIndex: input.sourceIndex,
      sourceKind: input.sourceKind as P6rStoredAttemptInput["sourceKind"],
    }))
    .sort((left, right) => left.groupIndex - right.groupIndex || left.sourceIndex - right.sourceIndex);
  return { createdAt: row.createdAt, id, inputs, nativeRequestId: row.nativeRequestId, nativeTurnId: nativeTurnIdForAttempt(db, row), threadId: row.threadId };
}

function nativeTurnIdForAttempt(
  db: DbQueryConnection,
  attempt: typeof p6rAttempts.$inferSelect,
): string | null {
  if (attempt.nativeTurnId !== null || attempt.nativeRequestId === null) {
    return attempt.nativeTurnId;
  }
  const matches = db.select({ turnId: events.turnId }).from(events).where(and(
    eq(events.threadId, attempt.threadId),
    eq(events.type, "turn/input/accepted"),
    eq(events.scopeKind, "turn"),
    isNotNull(events.turnId),
    sql`json_extract(${events.data}, '$.clientRequestId') = ${attempt.nativeRequestId}`,
  )).limit(2).all();
  if (matches.length !== 1) return null;
  const turnId = matches[0]?.turnId;
  return typeof turnId === "string" ? turnId : null;
}

export function linkP6rNativeTurnForRequest(
  db: DbQueryConnection,
  input: { readonly nativeRequestId: string; readonly threadId: string; readonly turnId: string },
): boolean {
  const matchingEvents = db.select({ turnId: events.turnId }).from(events).where(and(
    eq(events.threadId, input.threadId),
    eq(events.type, "turn/input/accepted"),
    eq(events.scopeKind, "turn"),
    eq(events.turnId, input.turnId),
    sql`json_extract(${events.data}, '$.clientRequestId') = ${input.nativeRequestId}`,
  )).limit(2).all();
  if (matchingEvents.length !== 1) return false;
  const attempts = db.select().from(p6rAttempts).where(and(
    eq(p6rAttempts.nativeRequestId, input.nativeRequestId),
    eq(p6rAttempts.threadId, input.threadId),
  )).all();
  if (attempts.length === 0 || attempts.some((attempt) =>
    attempt.nativeTurnId !== null && attempt.nativeTurnId !== input.turnId,
  )) {
    return false;
  }
  const pending = attempts.filter((attempt) => attempt.nativeTurnId === null);
  if (pending.length === 0) return false;
  db.update(p6rAttempts).set({ nativeTurnId: input.turnId }).where(and(
    eq(p6rAttempts.nativeRequestId, input.nativeRequestId),
    eq(p6rAttempts.threadId, input.threadId),
    sql`${p6rAttempts.nativeTurnId} IS NULL`,
  )).run();
  bumpHistoryRevision(db);
  return true;
}

export function listP6rAttempts(
  db: DbQueryConnection,
  operationNamespace: string,
  input: { readonly contributionId?: string; readonly operationId?: string },
): readonly P6rStoredAttempt[] {
  const receipt = input.operationId === undefined
    ? null
    : lookupP6rOperationReceipt(db, operationNamespace, input.operationId);
  if (input.operationId !== undefined && receipt?.nativeRequestId === null) return [];
  const rows = input.contributionId === undefined
    ? receipt === null ? [] : db.select().from(p6rAttempts).where(eq(p6rAttempts.nativeRequestId, receipt.nativeRequestId!)).all()
    : db.select().from(p6rAttemptInputs).all().filter((entry) =>
        logicalStoredId(entry.contributionId) === input.contributionId,
      ).flatMap((entry) => db.select().from(p6rAttempts).where(eq(p6rAttempts.id, entry.attemptId)).all());
  return rows.map((row) => storedAttempt(db, row))
    .filter((row): row is P6rStoredAttempt => row !== null)
    .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
}

export function listP6rAttemptsForNativeTurn(
  db: DbQueryConnection,
  input: { readonly threadId: string; readonly turnId: string },
): readonly P6rStoredAttempt[] {
  return db.select().from(p6rAttempts).where(eq(p6rAttempts.threadId, input.threadId)).all()
    .map((row) => storedAttempt(db, row))
    .filter((row): row is P6rStoredAttempt => row !== null && row.nativeTurnId === input.turnId)
    .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
}

function receiptFromRow(row: typeof p6rOperationReceipts.$inferSelect, operationNamespace: string, operationId: string): P6rOperationReceipt {
  if (
    row.status !== "accepted" &&
    row.status !== "indeterminate" &&
    row.status !== "pending" &&
    row.status !== "rejected"
  ) {
    throw new Error(`Unknown P6r receipt status "${row.status}"`);
  }
  return {
    acceptedAt: row.acceptedAt,
    acceptedRequestSequence: row.acceptedRequestSequence,
    contributionId:
      row.contributionId === null
        ? null
        : logicalRecordId(operationNamespace, row.contributionId),
    nativeRequestId: row.nativeRequestId,
    operationId,
    operationNamespace,
    payloadHash: row.payloadHash,
    retentionDeadline: row.retentionDeadline,
    status: row.status,
    threadId: row.threadId,
  };
}

export function acceptP6rOperationInTransaction(
  db: DbQueryConnection,
  draft: P6rAcceptanceDraft,
): P6rAcceptanceResult {
  const existing = db
    .select()
    .from(p6rOperationReceipts)
    .where(eq(p6rOperationReceipts.operationId, storageOperationId(draft.operationNamespace, draft.operationId)))
    .get();
  if (existing !== undefined) {
    if (existing.payloadHash !== draft.payloadHash) {
      throw new Error(`P6r operation "${draft.operationId}" payload mismatch`);
    }
    return { created: false, receipt: receiptFromRow(existing, draft.operationNamespace, draft.operationId) };
  }
  const validity = draft.assertLive();
  if (!validity.ok) {
    throw new Error(`P6r acceptance rejected: ${validity.code}`);
  }
  const contribution = draft.contribution;
  const contributionId = storageRecordId(draft.operationNamespace, contribution.id);
  db.insert(p6rContributions)
    .values({
      acceptedAt: contribution.acceptedAt,
      acceptedAuthorship: serialize(contribution.acceptedAuthorship),
      copiedFromContributionId: contribution.copiedFromContributionId === undefined ? null : storageRecordId(draft.operationNamespace, contribution.copiedFromContributionId),
      currentProjection: serialize(contribution.currentProjection),
      id: contributionId,
      initialInput: serialize(contribution.initialInput),
      latestEditor: serialize(contribution.latestEditor),
      nativeRequestId: contribution.nativeRequestId ?? null,
      replacesContributionId: contribution.replacesContributionId === undefined ? null : storageRecordId(draft.operationNamespace, contribution.replacesContributionId),
      threadId: contribution.threadId,
    })
    .run();
  const attempt = draft.attempt;
  if (attempt !== undefined) {
    const attemptId = storageRecordId(draft.operationNamespace, attempt.id);
    db.insert(p6rAttempts)
      .values({
        createdAt: attempt.createdAt,
        id: attemptId,
        nativeRequestId: attempt.nativeRequestId ?? null,
        nativeTurnId: attempt.nativeTurnId ?? null,
        retryOfAttemptId: attempt.retryOfAttemptId === undefined ? null : storageRecordId(draft.operationNamespace, attempt.retryOfAttemptId),
        threadId: attempt.threadId,
      })
      .run();
    for (const source of attempt.inputs) {
      db.insert(p6rAttemptInputs)
        .values({
          attemptId,
          contributionId: source.contributionId === undefined ? null : storageRecordId(draft.operationNamespace, source.contributionId),
          groupIndex: source.groupIndex,
          snapshot: serialize(source.snapshot),
          sourceIndex: source.sourceIndex,
          sourceKind: source.sourceKind,
        })
        .run();
    }
  }
  const receipt: P6rOperationReceipt = {
    acceptedAt: draft.receipt.acceptedAt,
    acceptedRequestSequence: draft.receipt.acceptedRequestSequence ?? null,
    contributionId: contribution.id,
    nativeRequestId: draft.receipt.nativeRequestId ?? null,
    operationId: draft.operationId,
    operationNamespace: draft.operationNamespace,
    payloadHash: draft.payloadHash,
    retentionDeadline: draft.receipt.retentionDeadline,
    status: "accepted",
    threadId: draft.receipt.threadId,
  };
  const { operationNamespace: _operationNamespace, ...storedReceipt } = receipt;
  db.insert(p6rOperationReceipts)
    .values({
      ...storedReceipt,
      contributionId,
      operationId: storageOperationId(draft.operationNamespace, draft.operationId),
    })
    .run();
  bumpHistoryRevision(db);
  return { created: true, receipt };
}

export function reserveP6rQueuedOperationInTransaction(
  db: DbQueryConnection,
  input: {
    readonly acceptedAt: number;
    readonly acceptedAuthorship: JsonValue;
    readonly assertLive: () => P6rValidity;
    readonly contributionId: string;
    readonly input: JsonValue;
    readonly operationId: string;
    readonly operationNamespace: string;
    readonly payloadHash: string;
    readonly queuedMessageId: string;
    readonly retentionDeadline: number;
    readonly threadId: string;
  },
): P6rOperationReceipt {
  const storedOperationId = storageOperationId(input.operationNamespace, input.operationId);
  const existing = db.select().from(p6rOperationReceipts)
    .where(eq(p6rOperationReceipts.operationId, storedOperationId)).get();
  if (existing !== undefined) {
    if (existing.payloadHash !== input.payloadHash) {
      throw new Error(`P6r operation "${input.operationId}" payload mismatch`);
    }
    return receiptFromRow(existing, input.operationNamespace, input.operationId);
  }
  const validity = input.assertLive();
  if (!validity.ok) {
    throw new Error(`P6r acceptance rejected: ${validity.code}`);
  }
  db.insert(p6rOperationReceipts).values({
    acceptedAt: input.acceptedAt,
    acceptedRequestSequence: null,
    contributionId: null,
    nativeRequestId: null,
    operationId: storedOperationId,
    payloadHash: input.payloadHash,
    retentionDeadline: input.retentionDeadline,
    status: "pending",
    threadId: input.threadId,
  }).run();
  db.insert(p6rPendingQueuedDispatches).values({
    acceptedAuthorship: serialize(input.acceptedAuthorship),
    contributionId: storageRecordId(input.operationNamespace, input.contributionId),
    input: serialize(input.input),
    operationId: storedOperationId,
    queuedMessageId: input.queuedMessageId,
  }).run();
  bumpHistoryRevision(db);
  const receipt = lookupP6rOperationReceipt(db, input.operationNamespace, input.operationId);
  if (receipt === null) throw new Error("P6r queued operation reservation was not retained");
  return receipt;
}

export function p6rQueuedOperationReservation(
  db: DbQueryConnection,
  queuedMessageId: string,
): P6rQueuedOperationReservation | null {
  const pending = db.select().from(p6rPendingQueuedDispatches)
    .where(eq(p6rPendingQueuedDispatches.queuedMessageId, queuedMessageId)).get();
  if (pending === undefined) return null;
  const receiptRow = db.select().from(p6rOperationReceipts)
    .where(eq(p6rOperationReceipts.operationId, pending.operationId)).get();
  if (receiptRow === undefined || receiptRow.status !== "pending") {
    throw new Error(`P6r queued message ${queuedMessageId} has no pending operation receipt`);
  }
  const parts = tupleParts(pending.operationId);
  if (parts === null || parts.length !== 2) throw new Error("Invalid P6r queued operation identifier");
  return {
    acceptedAuthorship: parseJson(pending.acceptedAuthorship),
    contributionId: logicalRecordId(parts[0]!, pending.contributionId),
    input: parseJson(pending.input),
    receipt: receiptFromRow(receiptRow, parts[0]!, parts[1]!),
  };
}

export function promoteP6rQueuedOperationInTransaction(
  db: DbQueryConnection,
  input: {
    readonly acceptedAt: number;
    readonly nativeRequestId: string;
    readonly queuedMessageId: string;
    readonly requestSequence: number;
    readonly retentionDeadline: number;
    readonly threadId: string;
  },
): P6rOperationReceipt | null {
  const reservation = p6rQueuedOperationReservation(db, input.queuedMessageId);
  if (reservation === null) return null;
  if (reservation.receipt.threadId !== input.threadId) {
    throw new Error("P6r queued operation thread mismatch");
  }
  const storedContributionId = storageRecordId(
    reservation.receipt.operationNamespace,
    reservation.contributionId,
  );
  const attemptId = storageRecordId(
    reservation.receipt.operationNamespace,
    `p6r-attempt:${reservation.receipt.operationId}:${input.requestSequence}`,
  );
  db.insert(p6rContributions).values({
    acceptedAt: input.acceptedAt,
    acceptedAuthorship: serialize(reservation.acceptedAuthorship),
    copiedFromContributionId: null,
    currentProjection: serialize(reservation.input),
    id: storedContributionId,
    initialInput: serialize(reservation.input),
    latestEditor: serialize(reservation.acceptedAuthorship),
    nativeRequestId: input.nativeRequestId,
    replacesContributionId: null,
    threadId: input.threadId,
  }).run();
  db.insert(p6rAttempts).values({
    createdAt: input.acceptedAt,
    id: attemptId,
    nativeRequestId: input.nativeRequestId,
    nativeTurnId: null,
    retryOfAttemptId: null,
    threadId: input.threadId,
  }).run();
  db.insert(p6rAttemptInputs).values({
    attemptId,
    contributionId: storedContributionId,
    groupIndex: 0,
    snapshot: serialize(reservation.input),
    sourceIndex: 0,
    sourceKind: "contribution",
  }).run();
  db.update(p6rOperationReceipts).set({
    acceptedAt: input.acceptedAt,
    acceptedRequestSequence: input.requestSequence,
    contributionId: storedContributionId,
    nativeRequestId: input.nativeRequestId,
    retentionDeadline: input.retentionDeadline,
    status: "accepted",
  }).where(eq(
    p6rOperationReceipts.operationId,
    storageOperationId(reservation.receipt.operationNamespace, reservation.receipt.operationId),
  )).run();
  db.delete(p6rPendingQueuedDispatches).where(eq(
    p6rPendingQueuedDispatches.queuedMessageId,
    input.queuedMessageId,
  )).run();
  bumpHistoryRevision(db);
  return lookupP6rOperationReceipt(
    db,
    reservation.receipt.operationNamespace,
    reservation.receipt.operationId,
  );
}

export function rejectP6rQueuedOperationInTransaction(
  db: DbQueryConnection,
  queuedMessageId: string,
): boolean {
  const reservation = p6rQueuedOperationReservation(db, queuedMessageId);
  if (reservation === null) return false;
  db.update(p6rOperationReceipts).set({ status: "rejected" }).where(eq(
    p6rOperationReceipts.operationId,
    storageOperationId(reservation.receipt.operationNamespace, reservation.receipt.operationId),
  )).run();
  db.delete(p6rPendingQueuedDispatches).where(eq(
    p6rPendingQueuedDispatches.queuedMessageId,
    queuedMessageId,
  )).run();
  bumpHistoryRevision(db);
  return true;
}

export function lookupP6rOperationReceipt(
  db: DbQueryConnection,
  operationNamespace: string,
  operationId: string,
): P6rOperationReceipt | null {
  const row = db
    .select()
    .from(p6rOperationReceipts)
    .where(eq(p6rOperationReceipts.operationId, storageOperationId(operationNamespace, operationId)))
    .get();
  return row === undefined ? null : receiptFromRow(row, operationNamespace, operationId);
}
