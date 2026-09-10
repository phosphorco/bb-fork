import { describe, expect, it } from "vitest";
import { createP6rInvocationRegistry } from "../../../src/services/p6r/invocation-registry.js";

describe("P6r invocation registry", () => {
  it("keeps a successor scope live when the exact predecessor retires", () => {
    let clock = 100;
    const registry = createP6rInvocationRegistry({ now: () => clock });
    const predecessor = registry.activateGeneration("generation-0");
    const first = registry.captureInvocation({
      deadlineAt: 200,
      generation: "generation-0",
      ingress: { requestId: "request-0", transport: "rpc" },
      sessionEpoch: "session-0",
    });
    const successor = registry.activateGeneration("generation-1");
    const second = registry.captureInvocation({
      deadlineAt: 200,
      generation: "generation-1",
      ingress: { requestId: "request-1", transport: "rpc" },
      sessionEpoch: "session-1",
    });

    expect(first).toMatchObject({ ok: true });
    expect(second).toMatchObject({ ok: true });
    if (!first.ok || !second.ok) throw new Error("expected captured scopes");

    predecessor.retire();

    expect(first.scope.validate()).toEqual({ ok: false, code: "retired" });
    expect(second.scope.validate()).toEqual({ ok: true });
    expect(registry.validateForward({
      destinationGeneration: successor.generation,
      scope: second.scope,
    })).toEqual({ ok: true });

    clock = 201;
    expect(second.scope.validate()).toEqual({ ok: false, code: "expired" });
  });

  it("rejects a late result and a retired forwarding destination", () => {
    const registry = createP6rInvocationRegistry({ now: () => 100 });
    const origin = registry.activateGeneration("origin");
    const destination = registry.activateGeneration("destination");
    const captured = registry.captureInvocation({
      deadlineAt: 200,
      generation: origin.generation,
      ingress: { requestId: "request-origin", transport: "http" },
      sessionEpoch: "epoch-origin",
    });

    expect(captured).toMatchObject({ ok: true });
    if (!captured.ok) throw new Error("expected captured scope");

    destination.retire();
    expect(registry.validateForward({
      destinationGeneration: destination.generation,
      scope: captured.scope,
    })).toEqual({ ok: false, code: "destination-retired" });

    const replacement = registry.activateGeneration("destination-next");
    expect(registry.validateForward({
      destinationGeneration: destination.generation,
      scope: captured.scope,
    })).toEqual({ ok: false, code: "destination-retired" });
    expect(registry.validateForward({
      destinationGeneration: replacement.generation,
      scope: captured.scope,
    })).toEqual({ ok: true });

    origin.retire();
    expect(registry.validateForward({
      destinationGeneration: "origin",
      scope: captured.scope,
    })).toEqual({ ok: false, code: "retired" });
  });

  it("invalidates exactly one session epoch without reviving a released scope", () => {
    const registry = createP6rInvocationRegistry({ now: () => 100 });
    const generation = registry.activateGeneration("generation");
    const first = registry.captureInvocation({
      deadlineAt: 200,
      generation: generation.generation,
      ingress: { requestId: "request-first", transport: "agent-tool" },
      sessionEpoch: "epoch-first",
    });
    const second = registry.captureInvocation({
      deadlineAt: 200,
      generation: generation.generation,
      ingress: { requestId: "request-second", transport: "agent-tool" },
      sessionEpoch: "epoch-second",
    });

    expect(first).toMatchObject({ ok: true });
    expect(second).toMatchObject({ ok: true });
    if (!first.ok || !second.ok) throw new Error("expected captured scopes");

    registry.invalidateSession({
      generation: generation.generation,
      sessionEpoch: "epoch-first",
    });
    second.scope.release();

    expect(first.scope.validate()).toEqual({ ok: false, code: "invalidated" });
    expect(second.scope.validate()).toEqual({ ok: false, code: "invalidated" });
  });

  it("rejects copied and foreign scope-shaped values before forwarding", () => {
    const registry = createP6rInvocationRegistry({ now: () => 100 });
    const foreignRegistry = createP6rInvocationRegistry({ now: () => 100 });
    const origin = registry.activateGeneration("origin");
    registry.activateGeneration("destination");
    const foreignOrigin = foreignRegistry.activateGeneration("origin");
    foreignRegistry.activateGeneration("destination");
    const captured = registry.captureInvocation({
      deadlineAt: 200,
      generation: origin.generation,
      ingress: { requestId: "request", transport: "rpc" },
      sessionEpoch: "epoch",
    });
    const foreign = foreignRegistry.captureInvocation({
      deadlineAt: 200,
      generation: foreignOrigin.generation,
      ingress: { requestId: "foreign-request", transport: "rpc" },
      sessionEpoch: "foreign-epoch",
    });

    expect(captured).toMatchObject({ ok: true });
    expect(foreign).toMatchObject({ ok: true });
    if (!captured.ok || !foreign.ok) throw new Error("expected captured scopes");

    const copied = {
      ...captured.scope,
      validate: () => ({ ok: true } as const),
    };
    expect(registry.validateForward({
      destinationGeneration: "destination",
      scope: copied,
    })).toEqual({ ok: false, code: "invalidated" });
    expect(registry.validateForward({
      destinationGeneration: "destination",
      scope: foreign.scope,
    })).toEqual({ ok: false, code: "invalidated" });
  });

  it("derives a distinct forwarding scope that requires both generations", () => {
    const registry = createP6rInvocationRegistry({ now: () => 100 });
    const source = registry.activateGeneration("source");
    const destination = registry.activateGeneration("destination");
    const captured = registry.captureInvocation({
      deadlineAt: 200,
      generation: source.generation,
      ingress: { requestId: "request", transport: "http" },
      sessionEpoch: "epoch",
    });
    if (!captured.ok) throw new Error("expected captured scope");

    const derived = registry.deriveForwardScope({
      destinationGeneration: destination.generation,
      sourceScope: captured.scope,
    });
    if (!derived.ok) throw new Error("expected derived scope");

    expect(derived.scope).not.toBe(captured.scope);
    expect(derived.scope.generation).toBe(destination.generation);
    expect(derived.scope.validate()).toEqual({ ok: true });

    destination.retire();
    expect(derived.scope.validate()).toEqual({ ok: false, code: "retired" });

    const replacement = registry.activateGeneration("destination-next");
    expect(
      registry.deriveForwardScope({
        destinationGeneration: replacement.generation,
        sourceScope: captured.scope,
      }),
    ).toMatchObject({ ok: true });
    source.retire();
    expect(captured.scope.validate()).toEqual({ ok: false, code: "retired" });
  });
});
