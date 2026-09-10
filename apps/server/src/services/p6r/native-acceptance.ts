import { getThread, replaceCoreParticipantProfilesInTransaction, type DbConnection, type DbQueryConnection } from "@bb/db";
import { promptInputSchema, type JsonObject, type JsonValue, type PromptInput, type Thread } from "@bb/domain";
import type { SendMessageRequest } from "@bb/server-contract";
import type { LoggedPendingInteractionWorkSessionDeps } from "../../types.js";
import { requireThreadCommandEnvironment } from "../threads/thread-command-environment.js";
import { attemptDispatch } from "../threads/dispatch-attempt.js";
import { appendThreadProvisionRequestInTransaction } from "../threads/thread-provisioning.js";
import { sendThreadMessage, type SendThreadMessageTransactionCommit, type SendThreadMessageTransactionPreflight } from "../threads/thread-send.js";
import type { P6rAcceptanceOutcome, P6rIdentityError, P6rJson, P6rNativeAcceptance } from "./identity-protocol.js";
import { p6rOutcomeFromStoredReceipt } from "./receipt-outcome.js";
import { lookupP6rOperationReceipt, acceptP6rOperationInTransaction, reserveP6rQueuedOperationInTransaction, type P6rOperationReceipt } from "./sidecar-store.js";
import { p6rContributions } from "./sidecar-schema.js";
import { z } from "zod";
import { eq } from "drizzle-orm";

export interface P6rNativeAcceptanceFactoryOptions {
  readonly deps?: LoggedPendingInteractionWorkSessionDeps;
  readonly db?: DbConnection;
  readonly dispatch?: (input: { readonly afterAppendInTransaction: SendThreadMessageTransactionCommit; readonly beforeAppendInTransaction: SendThreadMessageTransactionPreflight; readonly payload: SendMessageRequest; readonly thread: Thread }) => Promise<void>;
  readonly findThread?: (threadId: string) => Thread | null;
  readonly now: () => number;
  readonly retentionMs: number;
}

class ExistingP6rOperation extends Error { constructor(readonly receipt: P6rOperationReceipt) { super("P6r operation already accepted"); } }

function failure(code: P6rIdentityError["code"], message: string): P6rIdentityError { return { code, message, retry: code === "unavailable" ? "after-reconnect" : code === "expired" ? "same-operation" : "never" }; }
function rejected(code: P6rIdentityError["code"], message: string): P6rAcceptanceOutcome { return { status: "rejected", error: failure(code, message) }; }
function isJsonRecord(value: P6rJson): value is { readonly [key: string]: P6rJson } { return value !== null && typeof value === "object" && !Array.isArray(value); }
function isJsonArray(value: P6rJson): value is readonly P6rJson[] { return Array.isArray(value); }
function asJson(value: P6rJson): JsonValue { if (isJsonArray(value)) return value.map(asJson); if (isJsonRecord(value)) { const result: JsonObject = {}; for (const key of Object.keys(value)) Object.defineProperty(result, key, { value: asJson(value[key]!), enumerable: true, writable: true, configurable: true }); return result; } return value; }
function inputFromP6r(input: P6rNativeAcceptance["input"]): PromptInput[] | null {
  const values: PromptInput[] = [];
  for (const value of input.input) {
    const parsed = promptInputSchema.safeParse(value);
    if (!parsed.success) return null;
    values.push(parsed.data);
  }
  return values.length === 0 ? null : values;
}

const participantActorSchema = z.object({
  identity: z.discriminatedUnion("kind", [
    z.object({ key: z.string().min(1), kind: z.literal("person"), issuer: z.string().min(1), subject: z.string().min(1) }).passthrough(),
    z.object({ key: z.string().min(1), kind: z.literal("external"), pluginId: z.string().min(1), subject: z.string().min(1) }).passthrough(),
  ]),
  presentation: z.object({
    displayName: z.string().min(1),
    avatarUrl: z.string().min(1).nullable(),
  }).passthrough(),
}).passthrough();

function projectP6rParticipantsInTransaction(
  db: DbQueryConnection,
  threadId: string,
): void {
  const rows = db.select({
    acceptedAt: p6rContributions.acceptedAt,
    acceptedAuthorship: p6rContributions.acceptedAuthorship,
    latestEditor: p6rContributions.latestEditor,
  }).from(p6rContributions).where(eq(p6rContributions.threadId, threadId)).all();
  const profiles = new Map<string, { p6rPrincipalKey: string; identityKind: "external" | "person"; p6rDisplayName: string; imageUrl: string | null }>();
  let sourceVersion = 0;
  for (const row of rows) {
    sourceVersion = Math.max(sourceVersion, row.acceptedAt);
    for (const encoded of [row.acceptedAuthorship, row.latestEditor]) {
      try {
        const actor = participantActorSchema.safeParse(JSON.parse(encoded));
        if (!actor.success) continue;
        profiles.set(actor.data.identity.key, {
          p6rPrincipalKey: actor.data.identity.key,
          identityKind: actor.data.identity.kind,
          p6rDisplayName: actor.data.presentation.displayName,
          imageUrl: actor.data.presentation.avatarUrl,
        });
      } catch {}
    }
  }
  replaceCoreParticipantProfilesInTransaction(db, {
    threadId,
    sourceVersion,
    profiles: [...profiles.values()].sort((left, right) => left.p6rPrincipalKey.localeCompare(right.p6rPrincipalKey)),
  });
}

export function createP6rNativeAcceptance(options: P6rNativeAcceptanceFactoryOptions): (input: P6rNativeAcceptance) => Promise<P6rAcceptanceOutcome> {
  return async (input) => {
    const receiptDb = options.db ?? options.deps?.db;
    const promptInput = inputFromP6r(input.input);
    if (promptInput === null) return rejected("invalid-input", "P6r send input must contain native prompt inputs");
    const thread = options.findThread?.(input.input.threadId) ?? (options.deps === undefined ? null : getThread(options.deps.db, input.input.threadId));
    if (thread === null) return rejected("not-found", "P6r target thread was not found");
    const payload: SendMessageRequest = { input: promptInput, mode: input.input.mode };
    const contributionId = `p6r-contribution:${input.payloadHash}`;
    const beforeAppendInTransaction: SendThreadMessageTransactionPreflight = ({ tx }) => {
      const existing = lookupP6rOperationReceipt(tx, input.operationNamespace, input.input.operationId);
      if (existing !== null) {
        if (existing.payloadHash === input.payloadHash) throw new ExistingP6rOperation(existing);
        throw new Error("P6r operation identifier was reused with a different immutable payload");
      }
      const validity = input.validate();
      if (!validity.ok) throw new Error(`P6r invocation is no longer live: ${validity.code}`);
    };
    const afterAppendInTransaction: SendThreadMessageTransactionCommit = ({ request, tx }) => {
      const acceptedAt = options.now();
      acceptP6rOperationInTransaction(tx, {
        assertLive: input.validate,
        attempt: { createdAt: acceptedAt, id: `p6r-attempt:${input.input.operationId}:${request.sequence}`, inputs: [{ contributionId, groupIndex: 0, snapshot: asJson(input.input.input), sourceIndex: 0, sourceKind: "contribution" }], nativeRequestId: request.requestId, threadId: thread.id },
        contribution: { acceptedAt, acceptedAuthorship: asJson(input.authorEvidence), currentProjection: asJson(input.input.input), id: contributionId, initialInput: asJson(input.input.input), latestEditor: asJson(input.authorEvidence), nativeRequestId: request.requestId, threadId: thread.id },
        operationId: input.input.operationId,
        operationNamespace: input.operationNamespace,
        payloadHash: input.payloadHash,
        receipt: { acceptedAt, acceptedRequestSequence: request.sequence, nativeRequestId: request.requestId, retentionDeadline: acceptedAt + options.retentionMs, threadId: thread.id },
      });
      projectP6rParticipantsInTransaction(tx, thread.id);
    };
    try {
      if (thread.status === "pending") {
        if (options.deps === undefined) return rejected("unavailable", "Native P6r pending-thread acceptance dependencies are unavailable");
        await attemptDispatch(options.deps, {
          thread,
          payload,
          source: { kind: "inline" },
          queuePayload: { kind: "inline" },
          origin: null,
          originPluginId: null,
          startedOnBehalfOf: null,
          trigger: "user",
          queueReservation: ({ queuedMessage, tx }) => {
            beforeAppendInTransaction({ tx });
            reserveP6rQueuedOperationInTransaction(tx, {
              acceptedAt: options.now(),
              acceptedAuthorship: asJson(input.authorEvidence),
              assertLive: input.validate,
              contributionId,
              input: asJson(input.input.input),
              operationId: input.input.operationId,
              operationNamespace: input.operationNamespace,
              payloadHash: input.payloadHash,
              queuedMessageId: queuedMessage.id,
              retentionDeadline: options.now() + options.retentionMs,
              threadId: thread.id,
            });
          },
          pendingStartCommit: ({ provision, tx }) => {
            beforeAppendInTransaction({ tx });
            const request = appendThreadProvisionRequestInTransaction(tx, provision);
            afterAppendInTransaction({
              inputGroups: [payload.input],
              request: {
                requestId: request.clientRequestId,
                sequence: request.requestSequence,
              },
              tx,
            });
            return request;
          },
        });
      } else if (options.dispatch !== undefined) await options.dispatch({ afterAppendInTransaction, beforeAppendInTransaction, payload, thread });
      else {
        if (options.deps === undefined) return rejected("unavailable", "Native P6r acceptance dependencies are unavailable");
        const environment = await requireThreadCommandEnvironment(options.deps, { thread });
        await sendThreadMessage(options.deps, { afterAppendInTransaction, beforeAppendInTransaction, environment, payload, thread, trigger: "user" });
      }
    } catch (error) {
      if (error instanceof ExistingP6rOperation) return p6rOutcomeFromStoredReceipt(error.receipt);
      const committed = receiptDb === undefined ? null : lookupP6rOperationReceipt(receiptDb, input.operationNamespace, input.input.operationId);
      if (committed !== null && committed.payloadHash === input.payloadHash) return p6rOutcomeFromStoredReceipt(committed);
      return rejected("unavailable", error instanceof Error ? error.message : "Native P6r acceptance failed");
    }
    const durable = receiptDb === undefined ? null : lookupP6rOperationReceipt(receiptDb, input.operationNamespace, input.input.operationId);
    return durable === null || durable.payloadHash !== input.payloadHash
      ? { status: "indeterminate", operationId: input.input.operationId, message: "Native dispatch completed without a durable P6r receipt" }
      : p6rOutcomeFromStoredReceipt(durable);
  };
}
