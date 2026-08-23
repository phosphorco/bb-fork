import { performance } from "node:perf_hooks";
import {
  p6rUpsertActorSnapshot,
  p6rUpsertCollaborator,
  type DbConnection,
} from "@bb/db";
import type { Context } from "hono";
import {
  p6rActorSnapshotSchema,
  p6rPrincipalKeyForActorSnapshot,
  type P6rPrincipalKey,
  type P6rActorSnapshot,
  type P6rClaimedIdentity,
} from "@bb/domain";
import type {
  P6rIdentityProviderRegistration,
  P6rIdentityProviderResolution,
  P6rIdentityProviderRequest,
} from "@get-bb/plugin-sdk";
import { isLoopbackAddress, isLoopbackHostname } from "@bb/config/loopback";
import { getTrustedRemoteAddress } from "../request-context.js";

export const P6R_REQUEST_PRINCIPAL_CONTEXT_KEY = "p6rRequestPrincipal";
export const P6R_IDENTITY_PROVIDER_TIMEOUT_MS = 50;
export const P6R_LOCAL_OPERATOR_PROVIDER_ID = "p6r-local-operator";

export function p6rPrincipalKeyForActor(
  actor: P6rActorSnapshot,
): P6rPrincipalKey {
  return p6rPrincipalKeyForActorSnapshot(actor);
}

export interface P6rRequestResolution {
  kind: "authenticated";
  p6rActor: P6rActorSnapshot;
}

export interface P6rAnonymousRequestResolution {
  kind: "not-applicable";
  p6rRequestPrincipal: null;
}

export interface P6rRejectedRequestResolution {
  kind: "reject";
}

export type P6rBoundaryResolution =
  | P6rRequestResolution
  | P6rAnonymousRequestResolution
  | P6rRejectedRequestResolution;

export interface P6rIdentityProviderLease {
  p6rActivate(): void;
  p6rRelease(): void;
}

export interface P6rIdentityRequestInput extends P6rIdentityProviderRequest {
  remoteAddress?: string;
}

export interface P6rIdentityBoundary {
  p6rStageProvider(
    pluginId: string,
    registration: P6rIdentityProviderRegistration,
  ): P6rIdentityProviderLease;
  p6rRegisterProvider(
    pluginId: string,
    registration: P6rIdentityProviderRegistration,
  ): () => void;
  p6rResolveProvider(
    request: P6rIdentityRequestInput,
  ): P6rIdentityProviderResolution;
  p6rResolveRequest(request: P6rIdentityRequestInput): P6rBoundaryResolution;
  p6rRecordAuthenticatedActor(actor: P6rActorSnapshot): void;
}

declare module "hono" {
  interface ContextVariableMap {
    [P6R_REQUEST_PRINCIPAL_CONTEXT_KEY]: P6rActorSnapshot | null | undefined;
  }
}

function p6rNormalizeProviderResult(
  value: unknown,
  p6rProviderId: string,
): P6rIdentityProviderResolution | null {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const result = value as Record<string, unknown>;
    if (result.kind === "not-applicable" || result.kind === "reject") {
      return { kind: result.kind };
    }
    if (
      result.kind !== "authenticated" ||
      typeof result.p6rSubject !== "string" ||
      typeof result.p6rHandle !== "string" ||
      typeof result.p6rDisplayName !== "string" ||
      (result.p6rImageUrl !== null && typeof result.p6rImageUrl !== "string")
    ) {
      return null;
    }
    // p6rSubject is an opaque provider-defined key. Only use trim to reject
    // an empty value; never rewrite the key before persistence or lookup.
    const p6rSubject = result.p6rSubject;
    const p6rHandle = result.p6rHandle.normalize("NFKC").trim().toLowerCase();
    const p6rDisplayName = result.p6rDisplayName.trim();
    if (
      p6rSubject.trim().length === 0 ||
      p6rHandle.length === 0 ||
      p6rDisplayName.length === 0
    ) {
      return null;
    }
    const snapshot = p6rActorSnapshotSchema.safeParse({
      p6rProviderId,
      p6rSubject,
      p6rHandle,
      p6rDisplayName,
      p6rImageUrl: result.p6rImageUrl,
    });
    if (!snapshot.success) {
      return null;
    }
    return {
      kind: "authenticated",
      p6rSubject: snapshot.data.p6rSubject,
      p6rHandle: snapshot.data.p6rHandle,
      p6rDisplayName: snapshot.data.p6rDisplayName,
      p6rImageUrl: snapshot.data.p6rImageUrl,
    };
  } catch {
    // Provider output is untyped and may be a hostile Proxy. Malformed output
    // must never escape the boundary or rescue itself through loopback.
    return null;
  }
}

function p6rIsLoopbackRequest(request: P6rIdentityRequestInput): boolean {
  if (request.remoteAddress !== undefined) {
    return isLoopbackAddress(request.remoteAddress);
  }
  try {
    return isLoopbackHostname(new URL(request.url).hostname);
  } catch {
    return isLoopbackHostname(request.host);
  }
}

function p6rLocalOperatorActor(
  defaultActor: P6rClaimedIdentity,
): P6rActorSnapshot {
  return {
    p6rProviderId: P6R_LOCAL_OPERATOR_PROVIDER_ID,
    p6rSubject: defaultActor.p6rHandle,
    p6rHandle: defaultActor.p6rHandle,
    p6rDisplayName: defaultActor.p6rDisplayName,
    p6rImageUrl: defaultActor.p6rImageUrl,
  };
}

export function p6rCreateIdentityBoundary(args: {
  db: DbConnection;
  defaultActor: P6rClaimedIdentity;
  now(): number;
}): P6rIdentityBoundary {
  let provider:
    | {
        pluginId: string;
        registration: P6rIdentityProviderRegistration;
        p6rProviderId: string;
      }
    | undefined;
  let stagedProvider:
    | {
        pluginId: string;
        registration: P6rIdentityProviderRegistration;
        p6rProviderId: string;
      }
    | undefined;

  function validateProviderRegistration(
    pluginId: string,
    registration: P6rIdentityProviderRegistration,
  ) {
    if (stagedProvider !== undefined) {
      throw new Error(
        `p6r identity provider already has a staged registration by ${stagedProvider.pluginId}/${stagedProvider.registration.id}`,
      );
    }
    if (provider !== undefined && provider.pluginId !== pluginId) {
      throw new Error(
        `p6r identity provider already registered by ${provider.pluginId}/${provider.registration.id}`,
      );
    }
    if (
      typeof registration.id !== "string" ||
      !/^[a-z0-9][a-z0-9_-]{0,63}$/u.test(registration.id) ||
      typeof registration.resolve !== "function"
    ) {
      throw new Error("invalid p6r identity provider registration");
    }
    return {
      pluginId,
      registration,
      p6rProviderId: `${pluginId}/${registration.id}`,
    };
  }

  function p6rStageProvider(
    pluginId: string,
    registration: P6rIdentityProviderRegistration,
  ): P6rIdentityProviderLease {
    const registrationRecord = validateProviderRegistration(
      pluginId,
      registration,
    );
    stagedProvider = registrationRecord;
    let state: "staged" | "active" | "released" = "staged";
    return {
      p6rActivate() {
        if (state !== "staged") return;
        if (stagedProvider !== registrationRecord) {
          throw new Error(
            "p6r identity provider candidate is no longer staged",
          );
        }
        if (provider !== undefined && provider.pluginId !== pluginId) {
          throw new Error(
            `p6r identity provider already registered by ${provider.pluginId}/${provider.registration.id}`,
          );
        }
        provider = registrationRecord;
        stagedProvider = undefined;
        state = "active";
      },
      p6rRelease() {
        if (state === "staged") {
          if (stagedProvider === registrationRecord) stagedProvider = undefined;
        } else if (state === "active") {
          if (provider === registrationRecord) provider = undefined;
        }
        state = "released";
      },
    };
  }

  function p6rRegisterProvider(
    pluginId: string,
    registration: P6rIdentityProviderRegistration,
  ): () => void {
    if (provider !== undefined) {
      throw new Error(
        `p6r identity provider already registered by ${provider.pluginId}/${provider.registration.id}`,
      );
    }
    const lease = p6rStageProvider(pluginId, registration);
    lease.p6rActivate();
    return lease.p6rRelease;
  }

  function p6rResolveProvider(
    request: P6rIdentityRequestInput,
  ): P6rIdentityProviderResolution {
    const current = provider;
    if (current === undefined) return { kind: "not-applicable" };
    const startedAt = performance.now();
    let raw: unknown;
    try {
      raw = current.registration.resolve(request);
      const normalized = p6rNormalizeProviderResult(raw, current.p6rProviderId);
      if (performance.now() - startedAt > P6R_IDENTITY_PROVIDER_TIMEOUT_MS) {
        return { kind: "reject" };
      }
      return normalized ?? { kind: "reject" };
    } catch {
      return { kind: "reject" };
    }
  }

  function p6rRecordAuthenticatedActor(actor: P6rActorSnapshot): void {
    const now = args.now();
    p6rUpsertActorSnapshot(args.db, actor, now);
    p6rUpsertCollaborator(
      args.db,
      {
        p6rHandle: actor.p6rHandle,
        p6rDisplayName: actor.p6rDisplayName,
        p6rImageUrl: actor.p6rImageUrl,
      },
      now,
    );
  }

  return {
    p6rStageProvider,
    p6rRegisterProvider,
    p6rResolveProvider,
    p6rRecordAuthenticatedActor,
    p6rResolveRequest(request) {
      const providerResult = p6rResolveProvider(request);
      if (providerResult.kind === "authenticated") {
        const actorResult = p6rActorSnapshotSchema.safeParse({
          p6rProviderId:
            provider?.p6rProviderId ?? P6R_LOCAL_OPERATOR_PROVIDER_ID,
          p6rSubject: providerResult.p6rSubject,
          p6rHandle: providerResult.p6rHandle,
          p6rDisplayName: providerResult.p6rDisplayName,
          p6rImageUrl: providerResult.p6rImageUrl,
        });
        if (!actorResult.success) return { kind: "reject" };
        const actor: P6rActorSnapshot = actorResult.data;
        p6rRecordAuthenticatedActor(actor);
        return { kind: "authenticated", p6rActor: actor };
      }
      if (providerResult.kind === "reject") return { kind: "reject" };
      if (!p6rIsLoopbackRequest(request)) {
        return { kind: "not-applicable", p6rRequestPrincipal: null };
      }
      const actor = p6rLocalOperatorActor(args.defaultActor);
      p6rRecordAuthenticatedActor(actor);
      return { kind: "authenticated", p6rActor: actor };
    },
  };
}

export function p6rSetRequestPrincipal(
  context: Context,
  actor: P6rActorSnapshot | null,
): void {
  context.set(P6R_REQUEST_PRINCIPAL_CONTEXT_KEY, actor);
}

export function p6rGetRequestPrincipal(
  context: Context,
): P6rActorSnapshot | null {
  return context.get(P6R_REQUEST_PRINCIPAL_CONTEXT_KEY) ?? null;
}

export function p6rRequestInputFromContext(
  context: Context,
  transport: "http" | "websocket",
  trustedRemoteAddress?: string,
): P6rIdentityRequestInput {
  const url = new URL(context.req.url);
  return {
    transport,
    method: context.req.method,
    path: context.req.path,
    url: context.req.url,
    host: url.host,
    origin: url.origin,
    headers: Object.fromEntries(context.req.raw.headers.entries()),
    remoteAddress: trustedRemoteAddress ?? getTrustedRemoteAddress(context),
  };
}
