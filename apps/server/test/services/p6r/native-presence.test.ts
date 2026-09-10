import { describe, expect, it } from "vitest";
import type { P6rNativeWebSocketAdmission } from "../../../src/services/p6r/provider-admission.js";
import { createP6rNativePresenceService } from "../../../src/services/p6r/native-presence.js";

class Socket {
  readonly closed: Array<{
    code: number | undefined;
    reason: string | undefined;
  }> = [];
  readonly messages: unknown[] = [];

  close(code?: number, reason?: string): void {
    this.closed.push({ code, reason });
  }

  send(data: string): void {
    this.messages.push(JSON.parse(data) as unknown);
  }
}

function ready(input: {
  readonly controller: AbortController;
  readonly now: () => number;
  readonly validUntil: number;
}): Extract<P6rNativeWebSocketAdmission, { readonly status: "ready" }> {
  return {
    release: () => input.controller.abort(),
    session: {
      actor: {
        evidence: "provider-verified",
        identity: {
          issuer: "proof:issuer",
          key: "p6r-person:v1:proof",
          kind: "person",
          subject: "proof",
        },
        presentation: {
          avatarUrl: "/avatar",
          displayName: "Proof",
          handle: "proof",
        },
      },
      capabilities: {
        acceptance: "transactional-check",
        directory: { lookup: true, search: true },
        externalSend: "structured",
        forwarding: "host-bound",
        operationLookup: true,
        participants: true,
        requestIdentity: "host-resolved",
        toolProvenance: "partial",
      },
      instanceId: "proof",
      mode: "multi-user",
      stamp: "proof-session",
      status: "ready",
    },
    signal: input.controller.signal,
    status: "ready",
    validUntil: input.validUntil,
    validate: () =>
      input.controller.signal.aborted
        ? { code: "invalidated", ok: false }
        : input.now() >= input.validUntil
          ? { code: "expired", ok: false }
          : { ok: true },
  };
}

describe("native thread presence", () => {
  it("accepts only actor-free frames, fences invalidation, and scopes snapshots to one thread", () => {
    let current = 1_000;
    const now = () => current;
    const presence = createP6rNativePresenceService({
      now,
      presenceTtlMs: 100,
      typingTtlMs: 20,
    });
    const controller = new AbortController();
    const socket = new Socket();

    presence.open({
      admission: ready({ controller, now, validUntil: 2_000 }),
      socket,
      threadId: "thread-a",
    });
    expect(socket.messages).toMatchObject([
      {
        entries: [
          {
            actor: { identity: { key: "p6r-person:v1:proof" } },
            typing: false,
          },
        ],
        threadId: "thread-a",
        type: "snapshot",
      },
    ]);

    presence.receive(socket, JSON.stringify({ active: true, type: "typing" }));
    expect(socket.messages.at(-1)).toMatchObject({
      entries: [{ typing: true }],
      threadId: "thread-a",
      type: "snapshot",
    });

    const forged = new Socket();
    presence.open({
      admission: ready({
        controller: new AbortController(),
        now,
        validUntil: 2_000,
      }),
      socket: forged,
      threadId: "thread-b",
    });
    presence.receive(
      forged,
      JSON.stringify({ actor: "mallory", type: "renew" }),
    );
    expect(forged.closed).toEqual([
      { code: 1008, reason: "invalid-presence-message" },
    ]);

    controller.abort();
    expect(socket.messages.at(-1)).toEqual({
      status: "invalidated",
      type: "status",
    });
    expect(socket.closed).toEqual([{ code: 4003, reason: "invalidated" }]);

    const expired = new Socket();
    const expiredController = new AbortController();
    current = 2_000;
    presence.open({
      admission: ready({
        controller: expiredController,
        now,
        validUntil: 2_001,
      }),
      socket: expired,
      threadId: "thread-a",
    });
    current = 2_001;
    presence.receive(expired, JSON.stringify({ type: "renew" }));
    expect(expired.messages.at(-1)).toEqual({
      status: "expired",
      type: "status",
    });
    expect(expired.closed).toEqual([{ code: 4001, reason: "expired" }]);
  });
});
