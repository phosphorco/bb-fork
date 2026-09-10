import { describe, expect, it } from "vitest";
import type { ExperimentalP6rInvocationRegistration } from "@get-bb/plugin-sdk";
import {
  createP6rIdentityService,
  type P6rNativeAcceptance,
} from "../../../src/services/p6r/identity-protocol.js";
import { createP6rInvocationRegistry } from "../../../src/services/p6r/invocation-registry.js";
import { createP6rProviderRegistry } from "../../../src/services/p6r/provider-registry.js";
import { createConnection, migrate } from "@bb/db";
import type { JsonValue } from "@bb/domain";
import { migrateP6rSidecars } from "../../../src/services/p6r/sidecar-migrate.js";
import { acceptP6rOperationInTransaction } from "../../../src/services/p6r/sidecar-store.js";
import { getServerP6rToolCorrelationRegistry } from "../../../src/services/p6r/tool-correlation-registry.js";

function readySession(stamp = "stamp") {
  return {
    actor: {
      evidence: "provider-verified" as const,
      identity: {
        issuer: "issuer",
        key: "person-key",
        kind: "person" as const,
        subject: "subject",
      },
      presentation: { avatarUrl: null, displayName: "Person", handle: "person" },
    },
    capabilities: {
      acceptance: "transactional-check" as const,
      directory: { lookup: false, search: false },
      externalSend: "structured" as const,
      forwarding: "host-bound" as const,
      operationLookup: true,
      participants: false,
      requestIdentity: "host-resolved" as const,
      toolProvenance: "unknown" as const,
    },
    instanceId: "instance-proof",
    mode: "multi-user" as const,
    stamp,
    status: "ready" as const,
  };
}

describe("P6r identity protocol", () => {
  it("stages, activates, and retires only its exact generation", async () => {
    const registry = createP6rInvocationRegistry({ now: () => 100 });
    const registrations: ExperimentalP6rInvocationRegistration[] = [];
    const service = createP6rIdentityService({
      db: (() => { const db = createConnection(":memory:"); migrate(db); migrateP6rSidecars(db); return db; })(),
      instanceId: "instance-proof",
      invocationRegistry: registry,
      providerConfiguration: () => null,
      providerRegistry: createP6rProviderRegistry({ now: () => 100 }),
      native: {},
      now: () => 100,
      bindInvocation: (input) => {
        const registration: ExperimentalP6rInvocationRegistration = {
          generation: input.generation.generation,
          status: "staged",
          dispose: () => undefined,
        };
        registrations.push(registration);
        return {
          handler: () => {
            throw new Error("test handler is not dispatched");
          },
          registration,
        };
      },
      activateBindings: () => undefined,
      retireBindings: () => undefined,
      trustedInvocation: async () => ({
        deadlineAt: 200,
        session: {
          error: { code: "unavailable", message: "test", retry: "after-reconnect" },
          instanceId: "test",
          status: "unavailable",
        },
        sessionEpoch: "epoch",
      }),
    });
    const predecessorLifetime = new AbortController();
    const successorLifetime = new AbortController();
    const predecessor = service.forPluginGeneration(
      "plugin",
      "generation-0",
      predecessorLifetime.signal,
    );
    const successor = service.forPluginGeneration(
      "plugin",
      "generation-1",
      successorLifetime.signal,
    );

    expect(
      await service.captureInvocation({
        generation: "generation-0",
        ingress: { requestId: "before-active", transport: "rpc" },
        pluginId: "plugin",
        request: { requestId: "before-active" },
        routeClass: "anonymous",
      }),
    ).toEqual({ ok: false, code: "retired" });

    predecessor.activate();
    successor.activate();
    const captured = await service.captureInvocation({
      generation: "generation-1",
      ingress: { requestId: "active", transport: "rpc" },
        pluginId: "plugin",
        request: { requestId: "active" },
        routeClass: "anonymous",
    });
    expect(captured).toMatchObject({ ok: true });
    if (!captured.ok) throw new Error("expected captured scope");

    predecessor.retire();

    expect(captured.scope.validate()).toEqual({ ok: true });
    expect(successor.protocol.version).toBe(1);
    expect(registrations).toEqual([]);

    successorLifetime.abort();
    expect(captured.scope.validate()).toEqual({ ok: false, code: "retired" });
  });
});

describe("P6r identity acceptance snapshots", () => {
  it("freezes external author and input before an awaited native acceptance", async () => {
    const registry = createP6rInvocationRegistry({ now: () => 100 });
    const observed: { value: P6rNativeAcceptance | null } = { value: null };
    const deferred: { settle: ((value: { readonly status: "rejected"; readonly error: { readonly code: "unavailable"; readonly message: string; readonly retry: "after-reconnect" } }) => void) | null } = { settle: null };
    const service = createP6rIdentityService({
      db: (() => { const db = createConnection(":memory:"); migrate(db); migrateP6rSidecars(db); return db; })(),
      instanceId: "instance-proof",
      invocationRegistry: registry,
      providerConfiguration: () => null,
      providerRegistry: createP6rProviderRegistry({ now: () => 100 }),
      native: {
        accept: async (input) => new Promise((resolve) => {
          observed.value = input;
          deferred.settle = resolve;
        }),
      },
      now: () => 100,
      bindInvocation: () => ({
        handler: () => { throw new Error("test handler is not dispatched"); },
        registration: { dispose: () => undefined, generation: "unused", status: "staged" },
      }),
      activateBindings: () => undefined,
      retireBindings: () => undefined,
      trustedInvocation: async () => null,
    });
    const extension = service.forPluginGeneration("plugin", "generation", new AbortController().signal);
    extension.activate();
    const author = { presentation: { avatarUrl: null, displayName: "Before", handle: "before" }, subject: "author-before" };
    const input = { input: [{ text: "before" }], mode: "start" as const, operationId: "operation", threadId: "thread" };
    const pending = extension.protocol.accept({ source: { kind: "external", author }, input });
    author.presentation.displayName = "After";
    author.subject = "author-after";
    input.input[0]!.text = "after";
    expect(observed.value).toMatchObject({
      authorEvidence: { identity: { kind: "external", pluginId: "plugin", subject: "author-before" }, presentation: { displayName: "Before" } },
      input: { input: [{ text: "before" }] },
    });
    extension.retire();
    expect(observed.value?.validate()).toEqual({ ok: false, code: "retired" });
    if (deferred.settle === null) throw new Error("native acceptance did not start");
    deferred.settle({ status: "rejected", error: { code: "unavailable", message: "test", retry: "after-reconnect" } });
    await expect(pending).resolves.toMatchObject({ status: "rejected" });
    const firstHash = observed.value?.payloadHash;
    const successor = service.forPluginGeneration("plugin", "generation-successor", new AbortController().signal);
    successor.activate();
    const replay = successor.protocol.accept({
      source: { kind: "external", author: { presentation: { avatarUrl: null, displayName: "Before", handle: "before" }, subject: "author-before" } },
      input: { input: [{ text: "before" }], mode: "start", operationId: "operation", threadId: "thread" },
    });
    expect(observed.value?.payloadHash).toBe(firstHash);
    if (deferred.settle === null) throw new Error("replay native acceptance did not start");
    deferred.settle({ status: "rejected", error: { code: "unavailable", message: "test", retry: "after-reconnect" } });
    await expect(replay).resolves.toMatchObject({ status: "rejected" });
  });
});

describe("P6r durable receipt reconciliation", () => {
  it.each(["metadata", "__proto__"])("replays an exact receipt and rejects changed own %s payload", async (metadataKey) => {
    const db = createConnection(":memory:");
    migrate(db);
    migrateP6rSidecars(db);
    const registry = createP6rInvocationRegistry({ now: () => 100 });
    let nativeCalls = 0;
    const service = createP6rIdentityService({
      db,
      instanceId: "instance-proof",
      invocationRegistry: registry,
      providerConfiguration: () => null,
      providerRegistry: createP6rProviderRegistry({ now: () => 100 }),
      native: {
        accept: async (input) => {
          nativeCalls += 1;
          const captured = input.input.input[0];
          if (captured === null || typeof captured !== "object") throw new Error("Expected a snapshotted input object");
          expect(Object.hasOwn(captured, metadataKey)).toBe(true);
          db.transaction((tx) =>
            acceptP6rOperationInTransaction(tx, {
              assertLive: input.validate,
              contribution: {
                acceptedAt: 100,
                acceptedAuthorship: { source: "external" },
                currentProjection: { text: "hello" },
                id: "contribution",
                initialInput: { text: "hello" },
                latestEditor: { source: "external" },
                threadId: input.input.threadId,
              },
              operationId: input.input.operationId,
              operationNamespace: input.operationNamespace,
              payloadHash: input.payloadHash,
              receipt: {
                acceptedAt: 100,
                retentionDeadline: 1_000,
                threadId: input.input.threadId,
              },
            }),
          );
          return {
            status: "indeterminate",
            operationId: input.input.operationId,
            message: "lost response",
          };
        },
      },
      now: () => 100,
      bindInvocation: () => ({ handler: () => { throw new Error("test handler is not dispatched"); }, registration: { dispose: () => undefined, generation: "unused", status: "staged" } }),
      activateBindings: () => undefined,
      retireBindings: () => undefined,
      trustedInvocation: async () => null,
    });
    const extension = service.forPluginGeneration("plugin", "generation", new AbortController().signal);
    extension.activate();
    const request = {
      source: {
        kind: "external" as const,
        author: {
          presentation: { avatarUrl: null, displayName: "Author", handle: null },
          subject: "author",
        },
      },
      input: {
        input: [{ text: "hello", [metadataKey]: "before" }],
        mode: "start" as const,
        operationId: "operation",
        threadId: "thread",
      },
    };

    await expect(extension.protocol.accept(request)).resolves.toMatchObject({
      status: "indeterminate",
    });
    await expect(extension.protocol.accept(request)).resolves.toMatchObject({
      status: "submitted",
      receipt: { operationId: "operation" },
    });
    await expect(extension.protocol.accept({
      ...request,
      input: { ...request.input, input: [{ text: "hello", [metadataKey]: "after" }] },
    })).resolves.toMatchObject({ status: "rejected", error: { code: "invalid-operation" } });
    expect(nativeCalls).toBe(1);
    await expect(extension.protocol.lookup("operation")).resolves.toMatchObject({
      ok: true,
      value: {
        status: "final",
        outcome: { status: "submitted", receipt: { operationId: "operation" } },
      },
    });
  });
});

describe("P6r request profile and invalidations", () => {
  it("serves a captured ready self profile only while its request scope is live", async () => {
    let clock = 100;
    const registry = createP6rInvocationRegistry({ now: () => clock });
    const service = createP6rIdentityService({
      db: (() => { const db = createConnection(":memory:"); migrate(db); migrateP6rSidecars(db); return db; })(),
      instanceId: "instance-proof",
      invocationRegistry: registry,
      providerConfiguration: () => null,
      providerRegistry: createP6rProviderRegistry({ now: () => clock }),
      native: {},
      now: () => clock,
      bindInvocation: () => ({ handler: () => { throw new Error("test handler is not dispatched"); }, registration: { dispose: () => undefined, generation: "unused", status: "staged" } }),
      activateBindings: () => undefined,
      retireBindings: () => undefined,
      trustedInvocation: async () => ({ deadlineAt: 200, session: readySession("profile-revision"), sessionEpoch: "epoch" }),
    });
    const extension = service.forPluginGeneration("plugin", "generation", new AbortController().signal);
    extension.activate();
    const request = {};
    await expect(service.captureInvocation({ generation: "generation", ingress: { requestId: "request", transport: "http" }, pluginId: "plugin", request, routeClass: "interactive-session" })).resolves.toMatchObject({ ok: true });
    await expect(extension.protocol.selfProfile(request)).resolves.toEqual({
      ok: true,
      value: {
        identity: { issuer: "issuer", key: "person-key", kind: "person", subject: "subject" },
        presentation: { avatarUrl: null, displayName: "Person", handle: "person" },
        revision: "profile-revision",
        status: "current",
      },
    });
    clock = 200;
    await expect(extension.protocol.selfProfile(request)).resolves.toMatchObject({
      ok: false,
      error: { code: "unavailable" },
    });
  });

  it("notifies provider changes without disposing a live feature generation", async () => {
    const registry = createP6rInvocationRegistry({ now: () => 100 });
    const providers = createP6rProviderRegistry({ now: () => 100 });
    const service = createP6rIdentityService({
      db: (() => { const db = createConnection(":memory:"); migrate(db); migrateP6rSidecars(db); return db; })(),
      instanceId: "instance-proof",
      invocationRegistry: registry,
      providerConfiguration: () => ({ boundaryId: "boundary", credentials: [], ingressIds: ["local"], pluginId: "plugin", resolver: { maxSessionAgeMs: 100, timeoutMs: 100 }, version: 1 }),
      providerRegistry: providers,
      native: {},
      now: () => 100,
      bindInvocation: () => ({ handler: () => { throw new Error("test handler is not dispatched"); }, registration: { dispose: () => undefined, generation: "unused", status: "staged" } }),
      activateBindings: () => undefined,
      retireBindings: () => undefined,
      trustedInvocation: async () => null,
    });
    const extension = service.forPluginGeneration("plugin", "generation", new AbortController().signal);
    extension.activate();
    const events: unknown[] = [];
    extension.protocol.subscribe(() => { throw new Error("listener fault"); });
    const unsubscribe = extension.protocol.subscribe((event) => events.push(event));
    const registered = await extension.protocol.registerProvider({
      issuers: ["issuer"],
      resolve: async () => ({ status: "not-applicable" }),
    });
    if (!registered.ok) throw new Error("expected staged provider");
    const prepared = service.preparedProvider("plugin", "generation");
    if (prepared === null) throw new Error("expected prepared provider");
    const published = providers.publish(prepared);
    if (!published.ok) throw new Error("expected published provider");
    providers.notifyPublished(prepared);
    registered.value.invalidate({ kind: "authentication" });
    registered.value.invalidate({ kind: "directory", revision: "opaque" });
    providers.retire(prepared);
    expect(events).toEqual([
      { kind: "session", reason: "provider" },
      { kind: "directory", keys: [] },
      { kind: "session", reason: "provider" },
    ]);
    unsubscribe();
    extension.retire();
    expect(events).toHaveLength(3);
  });
});

describe("P6r retained history", () => {
  it("returns retained provenance only for the exact server-bound tool context", async () => {
    const db = createConnection(":memory:");
    migrate(db);
    migrateP6rSidecars(db);
    db.transaction((tx) => acceptP6rOperationInTransaction(tx, {
      assertLive: () => ({ ok: true }),
      attempt: {
        createdAt: 100,
        id: "attempt-tool-provenance",
        inputs: [{ contributionId: "contribution-tool-provenance", groupIndex: 0, snapshot: { text: "input" }, sourceIndex: 0, sourceKind: "contribution" }],
        nativeRequestId: "request-tool-provenance",
        nativeTurnId: "turn-tool-provenance",
        threadId: "thread-tool-provenance",
      },
      contribution: {
        acceptedAt: 100,
        acceptedAuthorship: { source: "external" },
        currentProjection: { text: "input" },
        id: "contribution-tool-provenance",
        initialInput: { text: "input" },
        latestEditor: { source: "external" },
        nativeRequestId: "request-tool-provenance",
        threadId: "thread-tool-provenance",
      },
      operationId: "operation-tool-provenance",
      operationNamespace: "plugin",
      payloadHash: "hash-tool-provenance",
      receipt: { acceptedAt: 100, nativeRequestId: "request-tool-provenance", retentionDeadline: 1_000, threadId: "thread-tool-provenance" },
    }));
    const registry = createP6rInvocationRegistry({ now: () => 100 });
    const service = createP6rIdentityService({
      db,
      instanceId: "instance-proof",
      invocationRegistry: registry,
      providerConfiguration: () => null,
      providerRegistry: createP6rProviderRegistry({ now: () => 100 }),
      native: {},
      now: () => 100,
      bindInvocation: () => ({ handler: () => { throw new Error("test handler is not dispatched"); }, registration: { dispose: () => undefined, generation: "unused", status: "staged" } }),
      activateBindings: () => undefined,
      retireBindings: () => undefined,
      trustedInvocation: async () => null,
    });
    const extension = service.forPluginGeneration("plugin", "generation", new AbortController().signal);
    extension.activate();
    const admittedContext = {};
    getServerP6rToolCorrelationRegistry().bindContext(admittedContext, {
      callId: "call-tool-provenance",
      providerThreadId: "provider-tool-provenance",
      sessionId: "session-tool-provenance",
      threadId: "thread-tool-provenance",
      turnId: "turn-tool-provenance",
    });

    await expect(extension.protocol.provenance(admittedContext)).resolves.toMatchObject({
      ok: true,
      value: {
        status: "known",
        correlation: {
          attemptId: "attempt-tool-provenance",
          threadId: "thread-tool-provenance",
          toolCallId: "call-tool-provenance",
          turnId: "turn-tool-provenance",
        },
      },
    });
    await expect(extension.protocol.provenance({})).resolves.toMatchObject({
      ok: true,
      value: { status: "unknown" },
    });
  });

  it("pages visible retained contributions and projects external authors with editors", async () => {
    const db = createConnection(":memory:");
    migrate(db);
    migrateP6rSidecars(db);
    const write = (operationId: string, contributionId: string, author: JsonValue, options: { readonly latestEditor?: JsonValue; readonly replacesContributionId?: string } = {}) => db.transaction((tx) => acceptP6rOperationInTransaction(tx, {
      assertLive: () => ({ ok: true }),
      contribution: {
        acceptedAt: 100 + operationId.length,
        acceptedAuthorship: author,
        currentProjection: { text: contributionId },
        id: contributionId,
        initialInput: { text: contributionId },
        latestEditor: options.latestEditor ?? author,
        ...(options.replacesContributionId === undefined ? {} : { replacesContributionId: options.replacesContributionId }),
        threadId: "thread",
      },
      operationId,
      operationNamespace: `producer-${operationId}`,
      payloadHash: `hash-${operationId}`,
      receipt: { acceptedAt: 100, retentionDeadline: 1_000, threadId: "thread" },
    }));
    const external = { evidence: "integration-asserted", identity: { key: "external-key", kind: "external", pluginId: "producer", subject: "external" }, presentation: { avatarUrl: null, displayName: "External", handle: null } };
    const person = { evidence: "provider-verified", identity: { issuer: "issuer", key: "person-key", kind: "person", subject: "editor" }, presentation: { avatarUrl: null, displayName: "Editor", handle: "editor" } };
    write("old", "old", external);
    write("edit", "edit", external, { latestEditor: person, replacesContributionId: "old" });
    write("other", "other", person);
    write("system", "system", { kind: "system", reason: "plugin-sdk" });
    const registry = createP6rInvocationRegistry({ now: () => 100 });
    const service = createP6rIdentityService({
      db,
      instanceId: "instance-proof",
      invocationRegistry: registry,
      providerConfiguration: () => null,
      providerRegistry: createP6rProviderRegistry({ now: () => 100 }),
      native: {},
      now: () => 100,
      bindInvocation: () => ({ handler: () => { throw new Error("test handler is not dispatched"); }, registration: { dispose: () => undefined, generation: "unused", status: "staged" } }),
      activateBindings: () => undefined,
      retireBindings: () => undefined,
      trustedInvocation: async () => null,
    });
    const extension = service.forPluginGeneration("plugin", "generation", new AbortController().signal);
    extension.activate();
    const first = await extension.protocol.historyContributions({
      kind: "references",
      limit: 1,
      references: [
        { contributionId: "edit", threadId: "thread" },
        { contributionId: "other", threadId: "thread" },
      ],
    });
    expect(first).toMatchObject({ ok: true, value: { items: [{ reference: { contributionId: "edit" } }], traversal: "continued" } });
    if (!first.ok || first.value.status === "pending" || first.value.status === "unavailable" || first.value.nextCursor === null) throw new Error("expected contribution cursor");
    await expect(extension.protocol.historyContributions({
      kind: "references",
      cursor: first.value.nextCursor,
      limit: 1,
      references: [
        { contributionId: "edit", threadId: "thread" },
        { contributionId: "other", threadId: "thread" },
      ],
    })).resolves.toMatchObject({ ok: true, value: { items: [{ reference: { contributionId: "other" } }], traversal: "complete" } });
    await expect(extension.protocol.participants({ limit: 10, threadId: "thread" })).resolves.toMatchObject({
      ok: true,
      value: {
        coverage: "partial-history",
        items: [
          { identity: { key: "external-key", kind: "external" }, roles: ["author"] },
          { identity: { key: "person-key", kind: "person" }, roles: ["author", "editor"] },
        ],
      },
    });
    await expect(extension.protocol.historyContributions({
      kind: "references",
      limit: 10,
      references: [{ contributionId: "system", threadId: "thread" }],
    })).resolves.toMatchObject({
      ok: true,
      value: {
        items: [{ author: { kind: "system", reason: "plugin-sdk" } }],
      },
    });
    db.transaction((tx) => acceptP6rOperationInTransaction(tx, {
      assertLive: () => ({ ok: true }),
      attempt: {
        createdAt: 200,
        id: "generated-attempt",
        inputs: [{ contributionId: "generated-source", groupIndex: 0, snapshot: { purpose: "continuation" }, sourceIndex: 0, sourceKind: "generated" }],
        threadId: "thread",
      },
      contribution: {
        acceptedAt: 200,
        acceptedAuthorship: external,
        currentProjection: { text: "generated-source" },
        id: "generated-source",
        initialInput: { text: "generated-source" },
        latestEditor: external,
        threadId: "thread",
      },
      operationId: "generated-operation",
      operationNamespace: "producer-generated",
      payloadHash: "hash-generated",
      receipt: { acceptedAt: 200, retentionDeadline: 1_000, threadId: "thread" },
    }));
    await expect(extension.protocol.historyAttempts({
      kind: "contribution",
      limit: 10,
      reference: { contributionId: "generated-source", threadId: "thread" },
    })).resolves.toMatchObject({
      ok: true,
      value: { items: [{ status: "partial" }] },
    });
  });
});

describe("P6r identity forwarding", () => {
  it("derives a distinct destination scope and request with source session continuity", async () => {
    const registry = createP6rInvocationRegistry({ now: () => 100 });
    const forwardedRequests: object[] = [];
    const forwardedScopes: object[] = [];
    const service = createP6rIdentityService({
      db: (() => { const db = createConnection(":memory:"); migrate(db); migrateP6rSidecars(db); return db; })(),
      instanceId: "instance-proof",
      invocationRegistry: registry,
      providerConfiguration: () => null,
      providerRegistry: createP6rProviderRegistry({ now: () => 100 }),
      native: {
        forwardRpc: async (input) => {
          const derived = input.deriveScope("target-generation");
          if (derived === null) return { status: "unavailable" };
          try {
            forwardedRequests.push(derived.request);
            forwardedScopes.push(derived.scope);
            return input.input;
          } finally {
            derived.release();
          }
        },
      },
      now: () => 100,
      bindInvocation: () => ({ handler: () => { throw new Error("test handler is not dispatched"); }, registration: { dispose: () => undefined, generation: "unused", status: "staged" } }),
      activateBindings: () => undefined,
      retireBindings: () => undefined,
      trustedInvocation: async () => ({ deadlineAt: 200, session: { error: { code: "unavailable", message: "test", retry: "after-reconnect" }, instanceId: "instance-proof", status: "unavailable" }, sessionEpoch: "epoch" }),
    });
    const extension = service.forPluginGeneration("plugin", "generation", new AbortController().signal);
    const target = service.forPluginGeneration("target-plugin", "target-generation", new AbortController().signal);
    extension.activate();
    target.activate();
    const request = { requestId: "request-1" };
    const captured = await service.captureInvocation({ generation: "generation", ingress: { requestId: "request-1", transport: "rpc" }, pluginId: "plugin", request, routeClass: "anonymous" });
    if (!captured.ok) throw new Error("expected captured scope");
    await expect(extension.protocol.forwardRpc(captured.scope, { method: "target", pluginId: "target-plugin" }, { value: "input" })).resolves.toEqual({ value: "input" });
    expect(forwardedRequests[0]).not.toBe(request);
    expect(forwardedScopes[0]).not.toBe(captured.scope);
    captured.scope.release();
    await expect(extension.protocol.forwardRpc(captured.scope, { method: "target", pluginId: "target-plugin" }, { value: "input" })).resolves.toEqual({ status: "unavailable" });
  });
});
