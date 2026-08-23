import { hostname, userInfo } from "node:os";
import { p6rUpsertCollaborator, type DbConnection } from "@bb/db";
// Claimed presentation compatibility helpers. The request/upgrade middleware
// uses services/identity.ts for provider authority; these helpers only carry a
// validated presentation claim after local identity has been resolved.
import {
  P6R_CLAIMED_IDENTITY_HEADER,
  p6rClaimedIdentitySchema,
  p6rCreateLocalPrincipalKey,
  p6rDecodeClaimedIdentityHeader,
  p6rNormalizeHandle,
  type P6rClaimedIdentityClaim,
  type P6rClaimedIdentity,
} from "@bb/domain";
import type { Context } from "hono";

export const P6R_REQUEST_ACTOR_CONTEXT_KEY = "p6rRequestActor";
export const P6R_COLLABORATOR_WRITE_DEBOUNCE_MS = 60_000;

interface P6rClaimedIdentityHeaderReader {
  header(name: string): string | undefined;
}

interface P6rCollaboratorWrite {
  p6rDisplayName: string;
  p6rImageUrl: string | null;
  writtenAt: number;
}

export interface P6rActorService {
  p6rResolveRequest(reader: P6rClaimedIdentityHeaderReader): P6rClaimedIdentity;
  p6rResolveClaimedIdentity(
    claim: P6rClaimedIdentityClaim,
    authenticatedActor: P6rClaimedIdentity,
  ): P6rClaimedIdentity;
}

interface P6rCreateActorServiceArgs {
  db: DbConnection;
  defaultActor: P6rClaimedIdentity;
  now(): number;
}

declare module "hono" {
  interface ContextVariableMap {
    [P6R_REQUEST_ACTOR_CONTEXT_KEY]: P6rClaimedIdentity | undefined;
  }
}

export function p6rCreateLocalOperatorIdentity(): P6rClaimedIdentity {
  let username = "";
  try {
    username = userInfo().username.trim();
  } catch {
    // Some restricted runtimes cannot resolve the current OS user.
  }
  const normalizedUsername = p6rNormalizeHandle(username);
  const localHostname = hostname().trim();

  return {
    p6rHandle: normalizedUsername || "local",
    p6rDisplayName: username || localHostname || "local",
    p6rImageUrl: null,
    p6rClientId: "local",
    p6rPrincipalKey: p6rCreateLocalPrincipalKey(normalizedUsername || "local"),
  };
}

function p6rServerAuthorClaimedIdentity(
  identity: P6rClaimedIdentity,
  authenticatedActor: P6rClaimedIdentity,
): P6rClaimedIdentity {
  const { p6rPrincipalKey: _ignored, ...presentation } = identity;
  return {
    ...presentation,
    ...(authenticatedActor.p6rPrincipalKey === undefined
      ? {}
      : { p6rPrincipalKey: authenticatedActor.p6rPrincipalKey }),
  };
}

export function p6rResolveRequestActor(
  reader: P6rClaimedIdentityHeaderReader,
  defaultActor: P6rClaimedIdentity,
): P6rClaimedIdentity {
  const identity = p6rDecodeClaimedIdentityHeader(
    reader.header(P6R_CLAIMED_IDENTITY_HEADER),
  );
  return identity === null
    ? defaultActor
    : p6rServerAuthorClaimedIdentity(identity, defaultActor);
}

export function p6rCreateActorService(
  args: P6rCreateActorServiceArgs,
): P6rActorService {
  const recentWrites = new Map<string, P6rCollaboratorWrite>();

  function persistActor(actor: P6rClaimedIdentity): P6rClaimedIdentity {
    const now = args.now();
    const previousWrite = recentWrites.get(actor.p6rHandle);
    if (
      previousWrite !== undefined &&
      previousWrite.p6rDisplayName === actor.p6rDisplayName &&
      previousWrite.p6rImageUrl === actor.p6rImageUrl &&
      now - previousWrite.writtenAt < P6R_COLLABORATOR_WRITE_DEBOUNCE_MS
    ) {
      return actor;
    }

    p6rUpsertCollaborator(
      args.db,
      {
        p6rHandle: actor.p6rHandle,
        p6rDisplayName: actor.p6rDisplayName,
        p6rImageUrl: actor.p6rImageUrl,
      },
      now,
    );
    recentWrites.set(actor.p6rHandle, {
      p6rDisplayName: actor.p6rDisplayName,
      p6rImageUrl: actor.p6rImageUrl,
      writtenAt: now,
    });
    return actor;
  }

  return {
    p6rResolveRequest(reader): P6rClaimedIdentity {
      return persistActor(p6rResolveRequestActor(reader, args.defaultActor));
    },
    p6rResolveClaimedIdentity(claim, authenticatedActor): P6rClaimedIdentity {
      const identity = p6rClaimedIdentitySchema.parse({
        ...claim,
        p6rHandle: p6rNormalizeHandle(claim.p6rHandle),
      });
      return persistActor(
        p6rServerAuthorClaimedIdentity(identity, authenticatedActor),
      );
    },
  };
}

export function p6rSetRequestActor(
  context: Context,
  actor: P6rClaimedIdentity,
): void {
  context.set(P6R_REQUEST_ACTOR_CONTEXT_KEY, actor);
}

export function p6rGetRequestActor(context: Context): P6rClaimedIdentity {
  const actor = context.get(P6R_REQUEST_ACTOR_CONTEXT_KEY);
  if (actor === undefined) {
    throw new Error("Request actor has not been resolved");
  }
  return actor;
}
