import { generateKeyPairSync, sign, verify, type KeyObject } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createP6rProviderAdmission, type P6rAdmissionIngressFacts, type P6rAdmissionRequestFacts } from "../../../src/services/p6r/provider-admission.js";
import { createP6rProviderRegistry } from "../../../src/services/p6r/provider-registry.js";
import type { P6rForkIdentityProvider, P6rProviderConfiguration, P6rProviderEvidence, P6rProviderResolution } from "../../../src/services/p6r/provider-contract.js";

const configuration: P6rProviderConfiguration = { boundaryId: "signed-boundary", credentials: [{ field: "x-proof-assertion", name: "assertion", source: "header" }], ingressIds: ["proof-ingress"], pluginId: "provider-plugin", resolver: { maxSessionAgeMs: 100, timeoutMs: 25 }, version: 1 };

function assertion(key: KeyObject, subject: string, validUntil: number): string { const payload = `proof:issuer|${subject}|${validUntil}`; return `${payload}.${sign("RSA-SHA256", Buffer.from(payload), key).toString("base64url")}`; }
function signedProvider(publicKey: KeyObject, calls: { value: number }): P6rForkIdentityProvider {
  return {
    issuers: ["proof:issuer"],
    async resolve(evidence: P6rProviderEvidence): Promise<P6rProviderResolution> {
      calls.value += 1;
      const token = evidence.credentials.find((credential) => credential.name === "assertion")?.value;
      if (token === undefined) return { reason: "missing-assertion", status: "rejected" };
      if (token === "outage") return { reason: "fixture-outage", status: "unavailable" };
      const separator = token.lastIndexOf(".");
      if (separator < 1) return { reason: "malformed-assertion", status: "rejected" };
      const payload = token.slice(0, separator);
      const signature = Buffer.from(token.slice(separator + 1), "base64url");
      if (!verify("RSA-SHA256", Buffer.from(payload), publicKey, signature)) return { reason: "invalid-signature", status: "rejected" };
      const [issuer, subject, rawExpiry] = payload.split("|");
      const validUntil = Number(rawExpiry);
      if (issuer !== "proof:issuer" || subject === undefined || !Number.isFinite(validUntil)) return { reason: "invalid-claims", status: "rejected" };
      return { issuer, presentation: { avatarUrl: null, displayName: subject, handle: subject }, status: "resolved", subject, validUntil };
    },
  };
}

function requestFacts(now: number, token: string): P6rAdmissionRequestFacts { return { authority: "proof.test", cookie: () => null, header: (name) => name === "x-proof-assertion" ? token : null, method: "POST", pathname: "/api/plugins/feature/rpc", receivedAt: now, transport: "http" }; }
function ingress(lineage: string | null, kind: P6rAdmissionIngressFacts["kind"] = "owned-proxy"): P6rAdmissionIngressFacts { return { authenticatedPeer: "proof-peer", id: "proof-ingress", kind, lineage }; }

describe("P6r provider admission", () => {
  it("admits an offline signed assertion through selected provider P for feature F and preserves lineage continuity", async () => {
    let now = 100;
    const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const calls = { value: 0 };
    const registry = createP6rProviderRegistry({ now: () => now });
    const prepared = await registry.prepare({ configuration, deadlineAt: 125, generation: "provider-generation", provider: signedProvider(pair.publicKey, calls) });
    if (!prepared.ok) throw new Error("expected provider preparation");
    expect(registry.publish(prepared.value).ok).toBe(true);
    registry.notifyPublished(prepared.value);
    let token = assertion(pair.privateKey, "alice", 180);
    let facts = ingress("browser-session-1");
    const admission = createP6rProviderAdmission({ ingressFacts: () => facts, instanceId: "proof-instance", now: () => now, providerRegistry: registry, requestFacts: () => requestFacts(now, token), selectedConfiguration: () => configuration });
    const lifetime = new AbortController();
    const input = { generation: { generation: "feature-generation", lifetime: lifetime.signal, pluginId: "feature-plugin" }, ingress: { requestId: "request-1", transport: "http" as const }, request: {}, routeClass: "anonymous" as const };
    const first = await admission.trustedInvocation(input);
    const second = await admission.trustedInvocation({ ...input, ingress: { requestId: "request-2", transport: "http" } });
    expect(first?.session.status).toBe("ready");
    expect(second?.session.status).toBe("ready");
    expect(first?.sessionEpoch).toBe(second?.sessionEpoch);
    expect(first?.session.status === "ready" ? first.session.actor.identity.subject : null).toBe("alice");
    expect(calls.value).toBe(2);
    facts = ingress("browser-session-2");
    const separate = await admission.trustedInvocation({ ...input, ingress: { requestId: "request-3", transport: "http" } });
    expect(separate?.sessionEpoch).not.toBe(first?.sessionEpoch);
  });

  it("rejects unverified or direct ingress without forwarding an assertion to the provider", async () => {
    let now = 100;
    const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const calls = { value: 0 };
    const registry = createP6rProviderRegistry({ now: () => now });
    const prepared = await registry.prepare({ configuration, deadlineAt: 125, generation: "provider-generation", provider: signedProvider(pair.publicKey, calls) });
    if (!prepared.ok) throw new Error("expected provider preparation");
    expect(registry.publish(prepared.value).ok).toBe(true);
    const admission = createP6rProviderAdmission({ ingressFacts: () => ingress("browser-session", "unverified"), instanceId: "proof-instance", now: () => now, providerRegistry: registry, requestFacts: () => requestFacts(now, assertion(pair.privateKey, "alice", 180)), selectedConfiguration: () => configuration });
    const denied = await admission.trustedInvocation({ generation: { generation: "feature-generation", lifetime: new AbortController().signal, pluginId: "feature-plugin" }, ingress: { requestId: "direct", transport: "http" }, request: {}, routeClass: "anonymous" });
    expect(denied?.session.status).toBe("unauthenticated");
    expect(calls.value).toBe(0);
  });

  it("revokes the current lineage when the selected provider becomes unavailable", async () => {
    let now = 100;
    const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const calls = { value: 0 };
    const registry = createP6rProviderRegistry({ now: () => now });
    const prepared = await registry.prepare({ configuration, deadlineAt: 125, generation: "provider-generation", provider: signedProvider(pair.publicKey, calls) });
    if (!prepared.ok) throw new Error("expected provider preparation");
    expect(registry.publish(prepared.value).ok).toBe(true);
    let token = assertion(pair.privateKey, "alice", 180);
    const admission = createP6rProviderAdmission({ ingressFacts: () => ingress("browser-session"), instanceId: "proof-instance", now: () => now, providerRegistry: registry, requestFacts: () => requestFacts(now, token), selectedConfiguration: () => configuration });
    const input = { generation: { generation: "feature-generation", lifetime: new AbortController().signal, pluginId: "feature-plugin" }, ingress: { requestId: "request-1", transport: "http" as const }, request: {}, routeClass: "anonymous" as const };
    const established = await admission.trustedInvocation(input);
    if (established?.signal === undefined) throw new Error("expected admitted signal");
    token = "outage";
    const outage = await admission.trustedInvocation({ ...input, ingress: { requestId: "request-2", transport: "http" } });
    expect(outage?.session.status).toBe("unavailable");
    expect(established.signal.aborted).toBe(true);
  });

  it("discards a late resolution after a newer lineage admission wins", async () => {
    let now = 100;
    let release: ((value: P6rProviderResolution) => void) | undefined;
    let markStarted: (() => void) | undefined;
    const delayed = new Promise<P6rProviderResolution>((resolve) => { release = resolve; });
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const provider: P6rForkIdentityProvider = { issuers: ["proof:issuer"], async resolve(evidence) { if (evidence.credentials[0]?.value === "slow") { markStarted?.(); return delayed; } return { issuer: "proof:issuer", presentation: { avatarUrl: null, displayName: "Bob", handle: "bob" }, status: "resolved", subject: "bob", validUntil: 180 }; } };
    const registry = createP6rProviderRegistry({ now: () => now });
    const prepared = await registry.prepare({ configuration, deadlineAt: 125, generation: "provider-generation", provider });
    if (!prepared.ok) throw new Error("expected provider preparation");
    expect(registry.publish(prepared.value).ok).toBe(true);
    let token = "slow";
    const admission = createP6rProviderAdmission({ ingressFacts: () => ingress("browser-session"), instanceId: "proof-instance", now: () => now, providerRegistry: registry, requestFacts: () => requestFacts(now, token), selectedConfiguration: () => configuration });
    const input = { generation: { generation: "feature-generation", lifetime: new AbortController().signal, pluginId: "feature-plugin" }, ingress: { requestId: "request-1", transport: "http" as const }, request: {}, routeClass: "anonymous" as const };
    const slow = admission.trustedInvocation(input);
    await started;
    token = "bob";
    const winner = await admission.trustedInvocation({ ...input, ingress: { requestId: "request-2", transport: "http" } });
    release?.({ issuer: "proof:issuer", presentation: { avatarUrl: null, displayName: "Alice", handle: "alice" }, status: "resolved", subject: "alice", validUntil: 180 });
    expect(await slow).toBeNull();
    expect(winner?.session.status === "ready" ? winner.session.actor.identity.subject : null).toBe("bob");
  });

  it("fences scopes on targeted invalidation, exact retirement, expiry, and an A to B to A actor sequence", async () => {
    let now = 100;
    const callbacks = new Map<ReturnType<typeof setTimeout>, () => void>();
    const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const calls = { value: 0 };
    const registry = createP6rProviderRegistry({ now: () => now });
    const prepared = await registry.prepare({ configuration, deadlineAt: 125, generation: "provider-generation", provider: signedProvider(pair.publicKey, calls) });
    if (!prepared.ok) throw new Error("expected provider preparation");
    expect(registry.publish(prepared.value).ok).toBe(true);
    let token = assertion(pair.privateKey, "alice", 180);
    const admission = createP6rProviderAdmission({ clearTimeout: (handle) => { callbacks.delete(handle); clearTimeout(handle); }, ingressFacts: () => ingress("browser-session"), instanceId: "proof-instance", now: () => now, providerRegistry: registry, requestFacts: () => requestFacts(now, token), selectedConfiguration: () => configuration, setTimeout: (callback) => { const handle = setTimeout(() => undefined, 60_000); callbacks.set(handle, callback); return handle; } });
    const input = { generation: { generation: "feature-generation", lifetime: new AbortController().signal, pluginId: "feature-plugin" }, ingress: { requestId: "request-1", transport: "http" as const }, request: {}, routeClass: "anonymous" as const };
    const first = await admission.trustedInvocation(input);
    if (first?.signal === undefined) throw new Error("expected admitted signal");
    expect(first.signal.aborted).toBe(false);
    token = assertion(pair.privateKey, "bob", 180);
    const second = await admission.trustedInvocation({ ...input, ingress: { requestId: "request-2", transport: "http" } });
    expect(first.signal.aborted).toBe(true);
    expect(second?.session.status === "ready" ? second.session.actor.identity.subject : null).toBe("bob");
    if (second?.signal === undefined) throw new Error("expected second admitted signal");
    token = assertion(pair.privateKey, "alice", 180);
    const third = await admission.trustedInvocation({ ...input, ingress: { requestId: "request-3", transport: "http" } });
    expect(second.signal.aborted).toBe(true);
    expect(third?.sessionEpoch).not.toBe(first?.sessionEpoch);
    if (third?.signal === undefined) throw new Error("expected third admitted signal");
    expect(prepared.value.registration.invalidate({ kind: "authentication", subjects: [{ issuer: "proof:issuer", subject: "alice" }] }).ok).toBe(true);
    expect(third.signal.aborted).toBe(true);
    token = assertion(pair.privateKey, "charlie", 105);
    const expiring = await admission.trustedInvocation({ ...input, ingress: { requestId: "request-4", transport: "http" } });
    if (expiring?.signal === undefined) throw new Error("expected expiring admitted signal");
    const expire = [...callbacks.values()][0];
    if (expire === undefined) throw new Error("expected expiry callback");
    expire();
    expect(expiring.signal.aborted).toBe(true);
    token = assertion(pair.privateKey, "alice", 180);
    const retiring = await admission.trustedInvocation({ ...input, ingress: { requestId: "request-5", transport: "http" } });
    if (retiring?.signal === undefined) throw new Error("expected retiring admitted signal");
    registry.retire(prepared.value);
    expect(retiring.signal.aborted).toBe(true);
  });
});
