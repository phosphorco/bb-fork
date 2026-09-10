import { generateKeyPairSync, sign, verify, type KeyObject } from "node:crypto";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { P6rIdentityBoundaryConfig } from "@bb/config/server";
import {
  TRUSTED_P6R_LINEAGE_CONTEXT_KEY,
  TRUSTED_REMOTE_ADDRESS_CONTEXT_KEY,
} from "../../../src/request-context.js";
import { installP6rNativeHttpLineageMiddleware } from "../../../src/services/p6r/browser-lineage.js";
import { createP6rNativeHttpIdentityAdmission } from "../../../src/services/p6r/native-http-admission.js";
import {
  createP6rProviderAdmission,
  type P6rAdmissionIngressFacts,
  type P6rAdmissionRequestFacts,
  type P6rNativeHttpAdmission,
} from "../../../src/services/p6r/provider-admission.js";
import { createP6rProviderRegistry } from "../../../src/services/p6r/provider-registry.js";
import type {
  P6rForkIdentityProvider,
  P6rProviderConfiguration,
  P6rProviderEvidence,
  P6rProviderResolution,
} from "../../../src/services/p6r/provider-contract.js";

const configuration: P6rProviderConfiguration = {
  boundaryId: "native-http-boundary",
  credentials: [
    { field: "x-proof-assertion", name: "assertion", source: "header" },
  ],
  ingressIds: ["proof-ingress"],
  pluginId: "provider-plugin",
  resolver: { maxSessionAgeMs: 100, timeoutMs: 25 },
  version: 1,
};

const boundary: P6rIdentityBoundaryConfig = {
  configuration,
  trustedIngresses: [
    {
      authenticatedPeer: "proof-peer",
      id: "proof-ingress",
      kind: "owned-proxy",
      remoteAddresses: ["127.0.0.1"],
    },
  ],
};

interface HonoRequestContext {
  readonly get: (key: string) => unknown;
  readonly req: {
    readonly method: string;
    readonly path: string;
    readonly url: string;
    header(name: string): string | undefined;
  };
}

function isHonoRequestContext(value: object): value is HonoRequestContext {
  if (!("req" in value) || !("get" in value)) return false;
  const candidate = value.req;
  return (
    typeof value.get === "function" &&
    typeof candidate === "object" &&
    candidate !== null &&
    "method" in candidate &&
    "path" in candidate &&
    "url" in candidate &&
    "header" in candidate &&
    typeof candidate.method === "string" &&
    typeof candidate.path === "string" &&
    typeof candidate.url === "string" &&
    typeof candidate.header === "function"
  );
}

function assertion(
  key: KeyObject,
  subject: string,
  validUntil: number,
): string {
  const payload = `proof:issuer|${subject}|${validUntil}`;
  return `${payload}.${sign("RSA-SHA256", Buffer.from(payload), key).toString("base64url")}`;
}

function signedProvider(
  publicKey: KeyObject,
  calls: { value: number },
): P6rForkIdentityProvider {
  return {
    issuers: ["proof:issuer"],
    async resolve(
      evidence: P6rProviderEvidence,
    ): Promise<P6rProviderResolution> {
      calls.value += 1;
      const token = evidence.credentials.find(
        (credential) => credential.name === "assertion",
      )?.value;
      if (token === undefined) return { reason: "missing", status: "rejected" };
      if (token === "outage") {
        return { reason: "fixture-outage", status: "unavailable" };
      }
      const separator = token.lastIndexOf(".");
      if (separator < 1) return { reason: "malformed", status: "rejected" };
      const payload = token.slice(0, separator);
      const signature = Buffer.from(token.slice(separator + 1), "base64url");
      if (!verify("RSA-SHA256", Buffer.from(payload), publicKey, signature)) {
        return { reason: "invalid-signature", status: "rejected" };
      }
      const [issuer, subject, rawExpiry] = payload.split("|");
      const validUntil = Number(rawExpiry);
      if (
        issuer !== "proof:issuer" ||
        subject === undefined ||
        !Number.isFinite(validUntil)
      ) {
        return { reason: "invalid-claims", status: "rejected" };
      }
      return {
        issuer,
        presentation: {
          avatarUrl: "/avatars/alice",
          displayName: "Alice",
          handle: "alice",
        },
        status: "resolved",
        subject,
        validUntil,
      };
    },
  };
}

function requestFacts(request: object): P6rAdmissionRequestFacts | null {
  if (!isHonoRequestContext(request)) return null;
  const url = new URL(request.req.url);
  return {
    authority: url.host,
    cookie: () => null,
    header: (name) => request.req.header(name) ?? null,
    method: request.req.method,
    pathname: request.req.path,
    receivedAt: clock.value,
    transport: "http",
  };
}

function ingressFacts(request: object): P6rAdmissionIngressFacts | null {
  if (!isHonoRequestContext(request)) return null;
  const remoteAddress = request.get(TRUSTED_REMOTE_ADDRESS_CONTEXT_KEY);
  const lineage = request.get(TRUSTED_P6R_LINEAGE_CONTEXT_KEY);
  if (remoteAddress !== "127.0.0.1" || typeof lineage !== "string") return null;
  return {
    authenticatedPeer: "proof-peer",
    id: "proof-ingress",
    kind: "owned-proxy",
    lineage,
  };
}

const clock = { value: 100 };

describe("native HTTP P6r admission", () => {
  it("admits only a trusted Hono request, freezes its actor, and fences expiry", async () => {
    const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const calls = { value: 0 };
    const registry = createP6rProviderRegistry({ now: () => clock.value });
    const prepared = await registry.prepare({
      configuration,
      deadlineAt: 125,
      generation: "provider-generation",
      provider: signedProvider(pair.publicKey, calls),
    });
    if (!prepared.ok) throw new Error("expected provider preparation");
    expect(registry.publish(prepared.value).ok).toBe(true);
    registry.notifyPublished(prepared.value);
    const providerAdmission = createP6rProviderAdmission({
      configured: () => true,
      ingressFacts: ({ request }) => ingressFacts(request),
      instanceId: "proof-instance",
      now: () => clock.value,
      providerRegistry: registry,
      requestFacts,
      selectedConfiguration: () => configuration,
    });
    const nativeIdentity = createP6rNativeHttpIdentityAdmission({
      providerAdmission,
    });
    let admitted: P6rNativeHttpAdmission | undefined;
    const app = new Hono();
    app.use("*", async (context, next) => {
      context.set(
        TRUSTED_REMOTE_ADDRESS_CONTEXT_KEY,
        context.req.header("x-test-remote") ?? "127.0.0.1",
      );
      return next();
    });
    installP6rNativeHttpLineageMiddleware(app, { boundary });
    app.get("/api/v1/system/native-identity", async (context) =>
      context.json(await nativeIdentity.current(context)),
    );
    app.post("/api/v1/threads/thread-1/send", async (context) => {
      admitted = await nativeIdentity.admit(context);
      return context.json({ status: admitted.status });
    });
    const token = assertion(pair.privateKey, "alice", 105);
    const first = await app.request(
      "http://proof.test/api/v1/system/native-identity",
      { headers: { "x-proof-assertion": token } },
    );
    const cookie = first.headers.get("set-cookie");
    expect(cookie).toContain("bb_p6r_native_http_lineage=");
    await expect(first.json()).resolves.toMatchObject({
      actor: {
        evidence: "provider-verified",
        identity: { issuer: "proof:issuer", subject: "alice" },
        presentation: { avatarUrl: "/avatars/alice", displayName: "Alice" },
      },
      status: "ready",
    });
    const commit = await app.request(
      "http://proof.test/api/v1/threads/thread-1/send",
      {
        headers: {
          cookie: cookie?.split(";", 1)[0] ?? "",
          "x-proof-assertion": token,
        },
        method: "POST",
      },
    );
    expect(await commit.json()).toEqual({ status: "ready" });
    if (admitted?.status !== "ready")
      throw new Error("expected ready admission");
    expect(Object.isFrozen(admitted.session.actor)).toBe(true);
    expect(Object.isFrozen(admitted.session.actor.identity)).toBe(true);
    expect(admitted.session.capabilities.participants).toBe(true);
    clock.value = 105;
    expect(admitted.validate()).toEqual({ code: "expired", ok: false });
    const beforeForged = calls.value;
    const forged = await app.request(
      "http://proof.test/api/v1/system/native-identity",
      {
        headers: {
          "x-proof-assertion": assertion(pair.privateKey, "mallory", 200),
          "x-test-remote": "203.0.113.10",
        },
      },
    );
    await expect(forged.json()).resolves.toEqual({ status: "unauthenticated" });
    expect(calls.value).toBe(beforeForged);
    providerAdmission.dispose();
  });

  it("keeps an absent boundary baseline only until a boundary is configured", async () => {
    let configured = false;
    const admission = createP6rProviderAdmission({
      configured: () => configured,
      ingressFacts: () => null,
      instanceId: "proof-instance",
      now: () => clock.value,
      providerRegistry: createP6rProviderRegistry({ now: () => clock.value }),
      requestFacts: () => null,
      selectedConfiguration: () => null,
    });
    const baseline = await admission.admitNativeHttp({});
    if (baseline.status !== "baseline") throw new Error("expected baseline");
    expect(baseline.validate()).toEqual({ ok: true });
    configured = true;
    expect(baseline.validate()).toEqual({ code: "invalidated", ok: false });
    admission.dispose();
  });
});
