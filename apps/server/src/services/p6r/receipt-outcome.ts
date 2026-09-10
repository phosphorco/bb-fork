import type {
  P6rAcceptanceOutcome,
  P6rAcceptanceReceipt,
} from "./identity-protocol.js";
import type { P6rOperationReceipt } from "./sidecar-store.js";

export function p6rOutcomeFromStoredReceipt(
  receipt: P6rOperationReceipt,
): P6rAcceptanceOutcome {
  if (receipt.status === "rejected") {
    return {
      status: "rejected",
      error: {
        code: "cancelled",
        message: "The queued operation was cancelled before dispatch",
        retry: "never",
      },
    };
  }
  if (receipt.status !== "accepted") {
    return {
      status: "indeterminate",
      operationId: receipt.operationId,
      message: "The durable operation requires reconciliation",
    };
  }
  const outcome: P6rAcceptanceReceipt = {
    acceptedAt: new Date(receipt.acceptedAt).toISOString(),
    deduplication: "guaranteed",
    evidence: "host-accepted",
    native: {
      deliveryId: null,
      queuedMessageId: null,
      turnId: null,
    },
    operationId: receipt.operationId,
    provenance: "structured",
    references:
      receipt.contributionId === null
        ? []
        : [{ contributionId: receipt.contributionId, threadId: receipt.threadId }],
    retainedUntil: new Date(receipt.retentionDeadline).toISOString(),
  };
  return { status: "submitted", receipt: outcome };
}
