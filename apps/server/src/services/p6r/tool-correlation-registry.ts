export interface P6rNativeToolCall {
  readonly callId: string;
  readonly providerThreadId: string;
  readonly sessionId: string;
  readonly threadId: string;
  readonly turnId: string;
}

export type P6rToolCallOutcome = "failed" | "succeeded" | "unsupported";

export interface P6rToolCallCorrelation {
  readonly call: P6rNativeToolCall;
  readonly completedAt: number | null;
  readonly startedAt: number;
  readonly status: "pending" | "settled";
  readonly outcome: P6rToolCallOutcome | null;
}

export interface P6rToolCallLease {
  readonly correlation: P6rToolCallCorrelation;
  readonly created: boolean;
  settle(outcome: P6rToolCallOutcome): P6rToolCallCorrelation;
}

export interface P6rToolCorrelationRegistry {
  begin(call: P6rNativeToolCall): P6rToolCallLease;
  bindContext(context: object, call: P6rNativeToolCall): void;
  lookup(call: P6rNativeToolCall): P6rToolCallCorrelation | null;
  lookupContext(context: object): P6rNativeToolCall | null;
  pruneSettledBefore(time: number): number;
}

interface MutableCorrelation {
  readonly call: P6rNativeToolCall;
  completedAt: number | null;
  outcome: P6rToolCallOutcome | null;
  readonly startedAt: number;
}

function key(call: P6rNativeToolCall): string {
  return JSON.stringify([
    call.sessionId,
    call.threadId,
    call.providerThreadId,
    call.turnId,
    call.callId,
  ]);
}

function snapshot(record: MutableCorrelation): P6rToolCallCorrelation {
  return {
    call: record.call,
    completedAt: record.completedAt,
    startedAt: record.startedAt,
    status: record.completedAt === null ? "pending" : "settled",
    outcome: record.outcome,
  };
}

export function createP6rToolCorrelationRegistry(input?: {
  readonly now?: () => number;
}): P6rToolCorrelationRegistry {
  const now = input?.now ?? Date.now;
  const records = new Map<string, MutableCorrelation>();
  const contexts = new WeakMap<object, P6rNativeToolCall>();

  return {
    begin(call) {
      const existing = records.get(key(call));
      if (existing !== undefined) {
        return {
          correlation: snapshot(existing),
          created: false,
          settle: (outcome) => {
            if (existing.completedAt === null) {
              existing.completedAt = now();
              existing.outcome = outcome;
            }
            return snapshot(existing);
          },
        };
      }
      const record: MutableCorrelation = {
        call: { ...call },
        completedAt: null,
        outcome: null,
        startedAt: now(),
      };
      records.set(key(call), record);
      return {
        correlation: snapshot(record),
        created: true,
        settle: (outcome) => {
          if (record.completedAt === null) {
            record.completedAt = now();
            record.outcome = outcome;
          }
          return snapshot(record);
        },
      };
    },

    bindContext(context, call) {
      contexts.set(context, { ...call });
    },

    lookup(call) {
      const record = records.get(key(call));
      return record === undefined ? null : snapshot(record);
    },

    lookupContext(context) {
      return contexts.get(context) ?? null;
    },

    pruneSettledBefore(time) {
      let removed = 0;
      for (const [recordKey, record] of records) {
        if (record.completedAt === null || record.completedAt >= time) continue;
        records.delete(recordKey);
        removed += 1;
      }
      return removed;
    },
  };
}

const serverToolCorrelationRegistry = createP6rToolCorrelationRegistry();

export function getServerP6rToolCorrelationRegistry(): P6rToolCorrelationRegistry {
  return serverToolCorrelationRegistry;
}
