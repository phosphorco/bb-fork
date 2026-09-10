import {
  nativePresenceClientMessageSchema,
  nativePresenceServerMessageSchema,
  type NativePresenceEntry,
} from "@bb/server-contract";
import type { P6rNativeWebSocketAdmission } from "./provider-admission.js";

interface PresenceSocket {
  close(code?: number, reason?: string): void;
  send(data: string): void;
}

interface PresenceRecord {
  readonly admission: Extract<
    P6rNativeWebSocketAdmission,
    { readonly status: "ready" }
  >;
  readonly onAbort: () => void;
  readonly socket: PresenceSocket;
  readonly threadId: string;
  expiresAt: number;
  timeout: ReturnType<typeof setTimeout> | undefined;
  typingExpiresAt: number | null;
}

interface ThreadPresence {
  readonly records: Set<PresenceRecord>;
  revision: number;
}

export interface P6rNativePresenceService {
  close(socket: PresenceSocket): void;
  open(input: {
    readonly admission: Extract<
      P6rNativeWebSocketAdmission,
      { readonly status: "ready" }
    >;
    readonly socket: PresenceSocket;
    readonly threadId: string;
  }): void;
  receive(socket: PresenceSocket, raw: unknown): void;
}

export function createP6rNativePresenceService(input?: {
  readonly now?: () => number;
  readonly presenceTtlMs?: number;
  readonly typingTtlMs?: number;
}): P6rNativePresenceService {
  const now = input?.now ?? Date.now;
  const presenceTtlMs = input?.presenceTtlMs ?? 30_000;
  const typingTtlMs = input?.typingTtlMs ?? 5_000;
  const recordsBySocket = new Map<PresenceSocket, PresenceRecord>();
  const threads = new Map<string, ThreadPresence>();

  const presenceFor = (threadId: string): ThreadPresence => {
    const existing = threads.get(threadId);
    if (existing !== undefined) return existing;
    const created = { records: new Set<PresenceRecord>(), revision: 0 };
    threads.set(threadId, created);
    return created;
  };
  const entryFor = (
    records: Iterable<PresenceRecord>,
  ): NativePresenceEntry[] => {
    const entries = new Map<string, NativePresenceEntry>();
    const current = now();
    for (const record of records) {
      const actor = record.admission.session.actor;
      const previous = entries.get(actor.identity.key);
      entries.set(actor.identity.key, {
        actor,
        typing:
          (previous?.typing ?? false) ||
          (record.typingExpiresAt !== null && record.typingExpiresAt > current),
      });
    }
    return [...entries.values()].sort((left, right) =>
      left.actor.identity.key.localeCompare(right.actor.identity.key),
    );
  };
  const send = (socket: PresenceSocket, value: unknown): boolean => {
    const parsed = nativePresenceServerMessageSchema.safeParse(value);
    if (!parsed.success) return false;
    try {
      socket.send(JSON.stringify(parsed.data));
      return true;
    } catch {
      return false;
    }
  };
  const broadcastSnapshot = (threadId: string): void => {
    const presence = threads.get(threadId);
    if (presence === undefined) return;
    presence.revision += 1;
    const message = {
      entries: entryFor(presence.records),
      revision: presence.revision,
      threadId,
      type: "snapshot" as const,
    };
    for (const record of [...presence.records]) {
      if (!send(record.socket, message)) close(record.socket);
    }
  };
  const clearTimer = (record: PresenceRecord): void => {
    if (record.timeout !== undefined) clearTimeout(record.timeout);
    record.timeout = undefined;
  };
  const close = (socket: PresenceSocket): void => {
    const record = recordsBySocket.get(socket);
    if (record === undefined) return;
    recordsBySocket.delete(socket);
    clearTimer(record);
    record.admission.signal.removeEventListener("abort", record.onAbort);
    record.admission.release();
    const presence = threads.get(record.threadId);
    if (presence === undefined) return;
    presence.records.delete(record);
    if (presence.records.size === 0) threads.delete(record.threadId);
    else broadcastSnapshot(record.threadId);
  };
  const terminate = (
    record: PresenceRecord,
    status: "expired" | "invalidated",
  ): void => {
    send(record.socket, { status, type: "status" });
    try {
      record.socket.close(status === "expired" ? 4001 : 4003, status);
    } catch {}
    close(record.socket);
  };
  const schedule = (record: PresenceRecord): void => {
    clearTimer(record);
    const typingDeadline = record.typingExpiresAt;
    const deadline = Math.min(
      record.expiresAt,
      record.admission.validUntil,
      typingDeadline ?? Number.POSITIVE_INFINITY,
    );
    record.timeout = setTimeout(
      () => {
        const validity = record.admission.validate();
        if (!validity.ok || now() >= record.admission.validUntil) {
          const status =
            validity.ok || validity.code === "expired"
              ? "expired"
              : "invalidated";
          terminate(record, status);
          return;
        }
        if (now() >= record.expiresAt) {
          terminate(record, "expired");
          return;
        }
        if (
          record.typingExpiresAt !== null &&
          now() >= record.typingExpiresAt
        ) {
          record.typingExpiresAt = null;
          broadcastSnapshot(record.threadId);
        }
        schedule(record);
      },
      Math.max(0, deadline - now()),
    );
  };
  const renew = (record: PresenceRecord): boolean => {
    const validity = record.admission.validate();
    if (!validity.ok) {
      terminate(
        record,
        validity.code === "expired" ? "expired" : "invalidated",
      );
      return false;
    }
    record.expiresAt = Math.min(
      now() + presenceTtlMs,
      record.admission.validUntil,
    );
    schedule(record);
    return true;
  };
  return {
    close,
    open({ admission, socket, threadId }) {
      const existing = recordsBySocket.get(socket);
      if (existing !== undefined) close(socket);
      const validity = admission.validate();
      if (!validity.ok) {
        send(socket, {
          status: validity.code === "expired" ? "expired" : "invalidated",
          type: "status",
        });
        try {
          socket.close(
            validity.code === "expired" ? 4001 : 4003,
            validity.code,
          );
        } catch {}
        admission.release();
        return;
      }
      let record: PresenceRecord;
      record = {
        admission,
        expiresAt: Math.min(now() + presenceTtlMs, admission.validUntil),
        onAbort: () => terminate(record, "invalidated"),
        socket,
        threadId,
        timeout: undefined,
        typingExpiresAt: null,
      };
      admission.signal.addEventListener("abort", record.onAbort, {
        once: true,
      });
      recordsBySocket.set(socket, record);
      presenceFor(threadId).records.add(record);
      schedule(record);
      broadcastSnapshot(threadId);
    },
    receive(socket, raw) {
      const record = recordsBySocket.get(socket);
      if (record === undefined) return;
      const decoded =
        typeof raw === "string"
          ? nativePresenceClientMessageSchema.safeParse(
              (() => {
                try {
                  return JSON.parse(raw) as unknown;
                } catch {
                  return null;
                }
              })(),
            )
          : { success: false as const };
      if (!decoded.success) {
        try {
          socket.close(1008, "invalid-presence-message");
        } catch {}
        close(socket);
        return;
      }
      if (!renew(record)) return;
      if (decoded.data.type === "typing") {
        record.typingExpiresAt = decoded.data.active
          ? now() + typingTtlMs
          : null;
        schedule(record);
        broadcastSnapshot(record.threadId);
      }
    },
  };
}
