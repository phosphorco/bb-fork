import {
  isStandaloneBuiltinClearCommand,
  type JsonValue,
  type Thread,
} from "@bb/domain";
import type {
  SendMessageRequest,
  SendMessageResponse,
} from "@bb/server-contract";
import type { LoggedPendingInteractionWorkSessionDeps } from "../../types.js";
import { attemptDispatch } from "./dispatch-attempt.js";
import { requireThreadCommandEnvironment } from "./thread-command-environment.js";
import { sendThreadMessage } from "./thread-send.js";
import { appendThreadProvisionRequestInTransaction } from "./thread-provisioning.js";
import {
  recordP6rNativeWriteInTransaction,
  reserveP6rNativeQueuedWriteInTransaction,
  type P6rNativeWriteOrigin,
} from "../p6r/sidecar-store.js";

interface AcceptThreadSendRequestArgs {
  payload: SendMessageRequest;
  p6rNativeWriteOrigin?: P6rNativeWriteOrigin | null;
  thread: Thread;
}

function inputGroupSnapshot(input: SendMessageRequest["input"]): JsonValue[] {
  return input as unknown as JsonValue[];
}

function recordNativeWrite(
  origin: P6rNativeWriteOrigin | null | undefined,
  input: {
    readonly nativeRequestId: string;
    readonly requestGroups: readonly JsonValue[];
    readonly threadId: string;
  },
  tx: Parameters<typeof recordP6rNativeWriteInTransaction>[0],
): void {
  if (origin === null || origin === undefined) return;
  recordP6rNativeWriteInTransaction(tx, origin, {
    acceptedAt: Date.now(),
    attemptId: `p6r-native-attempt:${input.nativeRequestId}`,
    contributionIds: input.requestGroups.map(
      (_, groupIndex) =>
        `p6r-native-contribution:${input.nativeRequestId}:${groupIndex}`,
    ),
    inputGroups: input.requestGroups,
    nativeRequestId: input.nativeRequestId,
    threadId: input.threadId,
  });
}

export async function acceptThreadSendRequest(
  deps: LoggedPendingInteractionWorkSessionDeps,
  args: AcceptThreadSendRequestArgs,
): Promise<SendMessageResponse> {
  if (isStandaloneBuiltinClearCommand(args.payload.input)) {
    const environment = await requireThreadCommandEnvironment(deps, {
      thread: args.thread,
    });
    await sendThreadMessage(deps, {
      environment,
      payload: args.payload,
      thread: args.thread,
      trigger: "user",
    });
    return { ok: true, delivery: "sent" };
  }

  const outcome = await attemptDispatch(deps, {
    thread: args.thread,
    payload: args.payload,
    source: { kind: "inline" },
    queuePayload: { kind: "inline" },
    origin: null,
    originPluginId: null,
    ...(args.p6rNativeWriteOrigin === undefined
      ? {}
      : {
          pendingStartCommit: ({ provision, tx }) => {
            const request = appendThreadProvisionRequestInTransaction(tx, provision);
            recordNativeWrite(
              args.p6rNativeWriteOrigin,
              {
                nativeRequestId: request.clientRequestId,
                requestGroups: [inputGroupSnapshot(args.payload.input)],
                threadId: args.thread.id,
              },
              tx,
            );
            return request;
          },
          queueReservation: ({ queuedMessage, tx }) => {
            reserveP6rNativeQueuedWriteInTransaction(tx, {
              acceptedAt: Date.now(),
              input: inputGroupSnapshot(args.payload.input),
              origin: args.p6rNativeWriteOrigin ?? null,
              queuedMessageId: queuedMessage.id,
              threadId: args.thread.id,
            });
          },
          queuedAfterAppendInTransaction: ({ inputGroups, request, tx }) => {
            recordNativeWrite(
              args.p6rNativeWriteOrigin,
              {
                nativeRequestId: request.requestId,
                requestGroups: inputGroups as unknown as readonly JsonValue[],
                threadId: args.thread.id,
              },
              tx,
            );
          },
        }),
    startedOnBehalfOf: null,
    trigger: "user",
  });
  if (outcome.kind === "dispatched") {
    return { ok: true, delivery: "sent" };
  }
  return {
    ok: true,
    delivery: "queued",
    queuedMessage: outcome.entry,
  };
}
