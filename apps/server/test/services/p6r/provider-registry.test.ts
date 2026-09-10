import { describe, expect, it } from "vitest";
import { createP6rProviderRegistry } from "../../../src/services/p6r/provider-registry.js";
import type { P6rForkIdentityProvider, P6rProviderConfiguration, P6rProviderEvidence, P6rProviderResolution } from "../../../src/services/p6r/provider-contract.js";

const configuration = (pluginId = "fixture-provider"): P6rProviderConfiguration => ({
  boundaryId: "fixture-boundary",
  credentials: [{ field: "X-Fixture", name: "fixture", source: "header" }],
  ingressIds: ["fixture-ingress"],
  pluginId,
  resolver: { maxSessionAgeMs: 50, timeoutMs: 25 },
  version: 1,
});

const evidence = (clock: number): P6rProviderEvidence => ({
  configuration: configuration(),
  credentials: [{ name: "fixture", value: "credential" }],
  deadlineAt: clock + 100,
  ingress: { authenticatedPeer: "fixture", id: "fixture-ingress", kind: "owned-proxy" },
  request: { authority: "proof.test", method: "GET", pathname: "/", receivedAt: clock, transport: "http" },
  signal: new AbortController().signal,
  version: 1,
});

const resolved = (issuer = "fixture:issuer", subject = "subject-1", validUntil = 140): P6rProviderResolution => ({
  issuer,
  presentation: { avatarUrl: null, displayName: "Fixture", handle: "fixture" },
  status: "resolved",
  subject,
  validUntil,
});

const provider = (resolve: (input: P6rProviderEvidence) => Promise<P6rProviderResolution>): P6rForkIdentityProvider => ({
  issuers: ["fixture:issuer"],
  resolve,
});

describe("P6r provider registry", () => {
  it("accepts a resolver-only provider and caps expiry without inventing directory support", async () => {
    let clock = 100;
    const registry = createP6rProviderRegistry({ now: () => clock });
    const prepared = await registry.prepare({ configuration: configuration(), deadlineAt: 150, generation: "generation-1", provider: provider(async () => resolved("fixture:issuer", "subject-1", 140)) });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error("expected prepared provider");
    const published = registry.publish(prepared.value);
    expect(published.ok).toBe(true);
    registry.notifyPublished(prepared.value);
    expect(registry.directorySources()).toHaveLength(1);
    expect(registry.directorySources()[0]?.directory).toBeUndefined();
    expect(registry.directorySources()[0]?.lookup).toBeUndefined();
    expect(await registry.resolve(evidence(clock))).toMatchObject({ status: "resolved", validUntil: 140 });
    clock = 151;
    expect(await registry.resolve(evidence(clock))).toMatchObject({ status: "rejected", reason: "invalid-provider-expiry" });
  });

  it("retains the predecessor when optional readiness fails", async () => {
    const registry = createP6rProviderRegistry({ now: () => 100 });
    const first = await registry.prepare({ configuration: configuration(), deadlineAt: 150, generation: "generation-1", provider: provider(async () => resolved()) });
    if (!first.ok) throw new Error("expected first provider");
    expect(registry.publish(first.value).ok).toBe(true);
    const failing: P6rForkIdentityProvider = {
      issuers: ["fixture:issuer"],
      async resolve() { return resolved(); },
      async validateReadiness() { return { ok: false, error: { code: "unavailable", message: "not ready", retry: "after-reconnect" } }; },
    };
    const candidate = await registry.prepare({ configuration: configuration(), deadlineAt: 150, generation: "generation-2", provider: failing });
    expect(candidate).toMatchObject({ ok: false });
    expect(await registry.resolve(evidence(100))).toMatchObject({ status: "resolved", subject: "subject-1" });
  });

  it("rejects duplicate issuer declarations before staging", async () => {
    const registry = createP6rProviderRegistry({ now: () => 100 });
    const duplicate: P6rForkIdentityProvider = { issuers: ["fixture:issuer", "fixture:issuer"], async resolve() { return resolved(); } };
    expect(await registry.prepare({ configuration: configuration(), deadlineAt: 150, generation: "generation-1", provider: duplicate })).toMatchObject({ ok: false });
  });

  it("publishes without callbacks then retires only the exact predecessor", async () => {
    const registry = createP6rProviderRegistry({ now: () => 100 });
    const first = await registry.prepare({ configuration: configuration("same-plugin"), deadlineAt: 150, generation: "generation-1", provider: provider(async () => resolved()) });
    const next = await registry.prepare({ configuration: configuration("same-plugin"), deadlineAt: 150, generation: "generation-2", provider: provider(async () => resolved("fixture:issuer", "successor")) });
    if (!first.ok || !next.ok) throw new Error("expected staged providers");
    const events: string[] = [];
    first.value.registration.subscribe((status) => events.push(`first:${status}`));
    next.value.registration.subscribe((status) => events.push(`next:${status}`));
    expect(registry.publish(first.value).ok).toBe(true);
    registry.notifyPublished(first.value);
    const swap = registry.publish(next.value);
    expect(swap.ok).toBe(true);
    if (!swap.ok) throw new Error("expected published successor");
    expect(events).toEqual(["first:active"]);
    registry.notifyPublished(next.value);
    registry.retire(first.value);
    registry.retire(first.value);
    expect(events).toEqual(["first:active", "next:active", "first:retired"]);
    expect(await registry.resolve({ ...evidence(100), configuration: configuration("same-plugin") })).toMatchObject({ status: "resolved", subject: "successor" });
  });

  it("fences a late ignored-cancellation resolution after authentication invalidation", async () => {
    let release: ((value: P6rProviderResolution) => void) | undefined;
    const delayed = new Promise<P6rProviderResolution>((resolve) => { release = resolve; });
    const registry = createP6rProviderRegistry({ now: () => 100 });
    const prepared = await registry.prepare({ configuration: configuration(), deadlineAt: 150, generation: "generation-1", provider: provider(async () => delayed) });
    if (!prepared.ok) throw new Error("expected prepared provider");
    expect(registry.publish(prepared.value).ok).toBe(true);
    const pending = registry.resolve(evidence(100));
    expect(prepared.value.registration.invalidate({ kind: "authentication" }).ok).toBe(true);
    release?.(resolved());
    expect(await pending).toEqual({ status: "unavailable", reason: "provider-resolution-invalidated" });
  });

  it("encodes issuer and subject stably and rejects undeclared resolved issuers", async () => {
    const registry = createP6rProviderRegistry({ now: () => 100 });
    const prepared = await registry.prepare({ configuration: configuration(), deadlineAt: 150, generation: "generation-1", provider: provider(async () => resolved("other:issuer")) });
    if (!prepared.ok) throw new Error("expected prepared provider");
    expect(registry.publish(prepared.value).ok).toBe(true);
    expect(prepared.value.registration.person("fixture:issuer", "a:b")).toEqual({ ok: true, value: { issuer: "fixture:issuer", key: "p6r-person:v1:fixture%3Aissuer:a%3Ab", kind: "person", subject: "a:b" } });
    expect(await registry.resolve(evidence(100))).toEqual({ status: "rejected", reason: "undeclared-issuer-or-subject" });
  });

  it("emits post-mutation authentication and exact retirement invalidations with idempotent unsubscribe", async () => {
    const registry = createP6rProviderRegistry({ now: () => 100 });
    const prepared = await registry.prepare({ configuration: configuration(), deadlineAt: 150, generation: "generation-1", provider: provider(async () => resolved()) });
    if (!prepared.ok) throw new Error("expected prepared provider");
    expect(registry.publish(prepared.value).ok).toBe(true);
    const events: string[] = [];
    const unsubscribe = registry.subscribeInvalidations((event) => events.push(event.kind === "directory" ? `${event.kind}:${event.generation}` : `${event.kind}:${event.generation}:${event.epoch}`));
    expect(prepared.value.registration.invalidate({ kind: "authentication", subjects: [{ issuer: "fixture:issuer", subject: "subject-1" }] }).ok).toBe(true);
    expect(prepared.value.registration.invalidate({ kind: "directory", revision: "opaque-revision" }).ok).toBe(true);
    unsubscribe();
    unsubscribe();
    registry.retire(prepared.value);
    expect(events).toEqual(["authentication:generation-1:1", "directory:generation-1"]);
    const second = await registry.prepare({ configuration: configuration(), deadlineAt: 150, generation: "generation-2", provider: provider(async () => resolved()) });
    if (!second.ok) throw new Error("expected second provider");
    expect(registry.publish(second.value).ok).toBe(true);
    const retirement: string[] = [];
    registry.subscribeInvalidations((event) => retirement.push(`${event.kind}:${event.generation}`));
    registry.retire(second.value);
    expect(retirement).toEqual(["retired:generation-2"]);
  });

  it("rejects evidence for a different immutable boundary configuration", async () => {
    const registry = createP6rProviderRegistry({ now: () => 100 });
    const prepared = await registry.prepare({ configuration: configuration(), deadlineAt: 150, generation: "generation-1", provider: provider(async () => resolved()) });
    if (!prepared.ok) throw new Error("expected prepared provider");
    expect(registry.publish(prepared.value).ok).toBe(true);
    expect(await registry.resolve({ ...evidence(100), configuration: { ...configuration(), credentials: [{ field: "X-Other", name: "fixture", source: "header" }] } })).toEqual({ status: "unavailable", reason: "provider-configuration-mismatch" });
  });
});
