import { describe, expect, it } from "vitest";
import { createP6rToolCorrelationRegistry } from "../../../src/services/p6r/tool-correlation-registry.js";

const call = {
  callId: "call-1",
  providerThreadId: "provider-thread-1",
  sessionId: "session-1",
  threadId: "thread-1",
  turnId: "turn-1",
};

describe("P6r tool correlation registry", () => {
  it("preserves separate native calls that share only a call id", () => {
    let clock = 10;
    const registry = createP6rToolCorrelationRegistry({ now: () => clock });
    const first = registry.begin(call);
    clock = 20;
    const second = registry.begin({ ...call, sessionId: "session-2" });

    expect(first.created).toBe(true);
    expect(second.created).toBe(true);
    expect(first.correlation.startedAt).toBe(10);
    expect(second.correlation.startedAt).toBe(20);

    first.settle("succeeded");
    expect(registry.lookup(call)).toMatchObject({
      status: "settled",
      outcome: "succeeded",
    });
    expect(registry.lookup({ ...call, sessionId: "session-2" })).toMatchObject({
      status: "pending",
      outcome: null,
    });
  });

  it("does not replace the original correlation or settled outcome on retry", () => {
    let clock = 10;
    const registry = createP6rToolCorrelationRegistry({ now: () => clock });
    const first = registry.begin(call);
    clock = 15;
    const retry = registry.begin(call);

    expect(retry.created).toBe(false);
    expect(retry.correlation.startedAt).toBe(10);
    first.settle("failed");
    clock = 20;
    retry.settle("succeeded");

    expect(registry.lookup(call)).toEqual({
      call,
      completedAt: 15,
      outcome: "failed",
      startedAt: 10,
      status: "settled",
    });
  });

  it("prunes only settled correlation evidence before the requested bound", () => {
    let clock = 10;
    const registry = createP6rToolCorrelationRegistry({ now: () => clock });
    const settled = registry.begin(call);
    settled.settle("unsupported");
    clock = 20;
    registry.begin({ ...call, callId: "call-pending" });

    expect(registry.pruneSettledBefore(11)).toBe(1);
    expect(registry.lookup(call)).toBeNull();
    expect(registry.lookup({ ...call, callId: "call-pending" })).toMatchObject({
      status: "pending",
    });
  });

  it("retains correlation only for the server-issued tool context object", () => {
    const registry = createP6rToolCorrelationRegistry();
    const admittedContext = {};
    registry.bindContext(admittedContext, call);

    expect(registry.lookupContext(admittedContext)).toEqual(call);
    expect(registry.lookupContext({})).toBeNull();
  });
});
