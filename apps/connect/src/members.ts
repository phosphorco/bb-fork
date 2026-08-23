import { and, asc, eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { drizzle } from "drizzle-orm/d1";
import {
  auditLog,
  profile,
  schema,
  server,
  p6rServerMember,
  user,
  type ConnectDb,
} from "@bb/connect-db";
import { parseCookie, verifySessionCookie } from "./session.js";
import type { Env } from "./tunnel-do.js";

const SESSION_COOKIE = "__Secure-better-auth.session_token";
const P6R_MEMBER_ADMISSION_AUDIT_WINDOW_MS = 15 * 60 * 1000;

interface P6rAdmissionAuditState {
  lastWrittenAt: number;
  pending: Promise<void> | null;
}

// Per-isolate debounce. A pending write is shared too, so the burst of requests
// from one page load cannot race into a row per asset. Isolate restarts may
// duplicate the entry, which is intentionally acceptable for this audit log.
const p6rMemberAdmissionAuditState = new Map<string, P6rAdmissionAuditState>();

export interface P6rServerMembersRoute {
  p6rServerId: string;
  p6rMemberUserId: string | null;
}

export interface P6rServerMemberListing {
  p6rUserId: string;
  p6rHandle: string;
  p6rName: string;
  p6rImage: string | null;
  p6rAddedByUserId: string;
  p6rCreatedAt: number;
}

type P6rAddServerMemberResult =
  | { ok: true; p6rMember: P6rServerMemberListing }
  | {
      ok: false;
      reason: "already-member" | "cannot-add-owner" | "unknown-handle";
    };

interface P6rAtomicBatchDb {
  batch(
    queries: readonly [BatchItem<"sqlite">, BatchItem<"sqlite">],
  ): Promise<readonly unknown[]>;
}

interface P6rMemberAuditValues {
  userId: string;
  action: "member-added" | "member-admitted" | "member-removed";
  detail: Record<string, string>;
  createdAt: Date;
}

function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && /unique constraint/iu.test(error.message);
}

/** Affected-row count from either better-sqlite3 or D1. */
function affectedRows(result: unknown): number {
  if (typeof result === "object" && result !== null) {
    if ("changes" in result && typeof result.changes === "number") {
      return result.changes;
    }
    if (
      "meta" in result &&
      typeof result.meta === "object" &&
      result.meta !== null &&
      "changes" in result.meta &&
      typeof result.meta.changes === "number"
    ) {
      return result.meta.changes;
    }
  }
  throw new Error("server member mutation did not report affected rows");
}

function supportsAtomicBatch(
  db: ConnectDb,
): db is ConnectDb & P6rAtomicBatchDb {
  return "batch" in db && typeof db.batch === "function";
}

function auditLogValues(values: P6rMemberAuditValues) {
  return {
    id: crypto.randomUUID(),
    userId: values.userId,
    action: values.action,
    detail: JSON.stringify(values.detail),
    createdAt: values.createdAt,
  };
}

async function appendAuditLog(
  db: ConnectDb,
  values: P6rMemberAuditValues,
): Promise<void> {
  await db.insert(auditLog).values(auditLogValues(values)).run();
}

/** Parse the owner member-management API path before host routing. */
export function p6rMatchServerMembersRoute(
  pathname: string,
): P6rServerMembersRoute | null {
  const match = pathname.match(
    /^\/api\/p6r-servers\/([^/]+)\/p6r-members(?:\/([^/]+))?$/u,
  );
  if (!match) return null;
  try {
    return {
      p6rServerId: decodeURIComponent(match[1]),
      p6rMemberUserId: match[2] ? decodeURIComponent(match[2]) : null,
    };
  } catch {
    return null;
  }
}

/**
 * Verify membership and durably record a debounced admission before returning
 * true. A failed audit write rejects the request instead of admitting access
 * without the system's only verified access record.
 */
export async function p6rAdmitServerMember(
  db: ConnectDb,
  serverId: string,
  memberUserId: string,
  subdomain: string,
  now: number = Date.now(),
): Promise<boolean> {
  const membership = await db
    .select({ userId: p6rServerMember.p6rUserId })
    .from(p6rServerMember)
    .where(
      and(
        eq(p6rServerMember.p6rServerId, serverId),
        eq(p6rServerMember.p6rUserId, memberUserId),
      ),
    )
    .get();
  if (!membership) return false;

  const key = `${serverId}:${memberUserId}`;
  const current = p6rMemberAdmissionAuditState.get(key);
  if (current?.pending) {
    await current.pending;
    return true;
  }
  if (
    current &&
    now - current.lastWrittenAt < P6R_MEMBER_ADMISSION_AUDIT_WINDOW_MS
  ) {
    return true;
  }

  const pending = appendAuditLog(db, {
    userId: memberUserId,
    action: "member-admitted",
    detail: { p6rServerId: serverId, p6rSubdomain: subdomain },
    createdAt: new Date(now),
  });
  p6rMemberAdmissionAuditState.set(key, {
    lastWrittenAt: current?.lastWrittenAt ?? Number.NEGATIVE_INFINITY,
    pending,
  });
  try {
    await pending;
    p6rMemberAdmissionAuditState.set(key, {
      lastWrittenAt: now,
      pending: null,
    });
  } catch (error) {
    p6rMemberAdmissionAuditState.delete(key);
    throw error;
  }
  return true;
}

/** Owner-facing member projection, ordered by admission time then handle. */
export async function p6rListServerMembers(
  db: ConnectDb,
  serverId: string,
): Promise<P6rServerMemberListing[]> {
  const rows = await db
    .select({
      p6rUserId: p6rServerMember.p6rUserId,
      p6rHandle: profile.handle,
      p6rName: user.name,
      p6rImage: user.image,
      p6rAddedByUserId: p6rServerMember.p6rAddedByUserId,
      p6rCreatedAt: p6rServerMember.p6rCreatedAt,
    })
    .from(p6rServerMember)
    .innerJoin(profile, eq(profile.userId, p6rServerMember.p6rUserId))
    .innerJoin(user, eq(user.id, p6rServerMember.p6rUserId))
    .where(eq(p6rServerMember.p6rServerId, serverId))
    .orderBy(asc(p6rServerMember.p6rCreatedAt), asc(profile.handle))
    .all();
  return rows.map((row) => ({
    ...row,
    p6rCreatedAt: row.p6rCreatedAt.getTime(),
  }));
}

export async function p6rAddServerMember(
  db: ConnectDb,
  serverId: string,
  ownerUserId: string,
  rawHandle: string,
  now: Date = new Date(),
): Promise<P6rAddServerMemberResult> {
  const handle = rawHandle.trim().toLowerCase();
  const target = await db
    .select({
      userId: profile.userId,
      handle: profile.handle,
      name: user.name,
      image: user.image,
    })
    .from(profile)
    .innerJoin(user, eq(user.id, profile.userId))
    .where(eq(profile.handle, handle))
    .get();
  if (!target) return { ok: false, reason: "unknown-handle" };
  if (target.userId === ownerUserId) {
    return { ok: false, reason: "cannot-add-owner" };
  }

  try {
    const memberInsert = db.insert(p6rServerMember).values({
      p6rServerId: serverId,
      p6rUserId: target.userId,
      p6rAddedByUserId: ownerUserId,
      p6rCreatedAt: now,
    });
    const auditInsert = db.insert(auditLog).values(
      auditLogValues({
        userId: ownerUserId,
        action: "member-added",
        detail: { p6rServerId: serverId, p6rMemberUserId: target.userId },
        createdAt: now,
      }),
    );
    if (supportsAtomicBatch(db)) {
      await db.batch([memberInsert, auditInsert]);
    } else {
      // better-sqlite3 (used by the in-memory tests) has no batch method. Its
      // transaction callback and statements are synchronous, giving the same
      // all-or-nothing behavior as D1's implicit batch transaction.
      await db.transaction(() => {
        memberInsert.run();
        auditInsert.run();
      });
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { ok: false, reason: "already-member" };
    }
    throw error;
  }
  return {
    ok: true,
    p6rMember: {
      p6rUserId: target.userId,
      p6rHandle: target.handle,
      p6rName: target.name,
      p6rImage: target.image,
      p6rAddedByUserId: ownerUserId,
      p6rCreatedAt: now.getTime(),
    },
  };
}

export async function p6rRemoveServerMember(
  db: ConnectDb,
  serverId: string,
  ownerUserId: string,
  memberUserId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const membershipFilter = and(
    eq(p6rServerMember.p6rServerId, serverId),
    eq(p6rServerMember.p6rUserId, memberUserId),
  );
  if (supportsAtomicBatch(db)) {
    const auditId = crypto.randomUUID();
    const action = "member-removed";
    const detail = JSON.stringify({
      p6rServerId: serverId,
      p6rMemberUserId: memberUserId,
    });
    // Insert the audit row only when the member exists, then delete it in the
    // same D1 batch. This preserves the absent-member 404 without opening a
    // race between an existence check and the atomic mutation.
    const conditionalAuditInsert = db.insert(auditLog).select((qb) =>
      qb
        .select({
          id: sql<string>`${auditId}`.as("id"),
          userId: sql<string>`${ownerUserId}`.as("user_id"),
          action: sql<string>`${action}`.as("action"),
          detail: sql<string>`${detail}`.as("detail"),
          ipAddress: sql<string | null>`null`.as("ip_address"),
          createdAt: sql<Date>`${now.getTime()}`.as("created_at"),
        })
        .from(p6rServerMember)
        .where(membershipFilter)
        .limit(1),
    );
    const memberDelete = db.delete(p6rServerMember).where(membershipFilter);
    const results = await db.batch([conditionalAuditInsert, memberDelete]);
    return affectedRows(results[1]) > 0;
  }

  // See the add path above: this branch is the synchronous better-sqlite3
  // test double, whose transaction rolls the delete back if auditing fails.
  return await db.transaction((tx) => {
    const result = tx.delete(p6rServerMember).where(membershipFilter).run();
    if (affectedRows(result) === 0) return false;
    tx.insert(auditLog)
      .values(
        auditLogValues({
          userId: ownerUserId,
          action: "member-removed",
          detail: { p6rServerId: serverId, p6rMemberUserId: memberUserId },
          createdAt: now,
        }),
      )
      .run();
    return true;
  });
}

async function resolveOwnerSessionUserId(
  request: Request,
  secret: string,
  db: ConnectDb,
): Promise<string | null> {
  const cookie = parseCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (!cookie) return null;
  return verifySessionCookie(cookie, secret, db);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function resolveServerCredentialOwnerUserId(
  request: Request,
  serverId: string,
  db: ConnectDb,
): Promise<string | null> {
  const authorization = request.headers.get("authorization") ?? "";
  const credential = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  if (!credential) return null;

  const ownedServer = await db
    .select({
      credentialHash: server.credentialHash,
      revokedAt: server.revokedAt,
      userId: server.userId,
    })
    .from(server)
    .where(eq(server.id, serverId))
    .get();
  if (
    !ownedServer ||
    ownedServer.revokedAt !== null ||
    ownedServer.credentialHash === null
  ) {
    return null;
  }
  return (await sha256Hex(credential)) === ownedServer.credentialHash
    ? ownedServer.userId
    : null;
}

/** Testable owner-session member API using either D1 or in-memory SQLite. */
export async function p6rHandleServerMembersWithDb(
  request: Request,
  secret: string,
  db: ConnectDb,
  route: P6rServerMembersRoute,
): Promise<Response> {
  const isCollectionMethod =
    route.p6rMemberUserId === null &&
    (request.method === "GET" || request.method === "POST");
  const isItemMethod =
    route.p6rMemberUserId !== null && request.method === "DELETE";
  if (!isCollectionMethod && !isItemMethod) {
    const allow = route.p6rMemberUserId === null ? "GET, POST" : "DELETE";
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: {
        "content-type": "application/json; charset=utf-8",
        allow,
      },
    });
  }

  const credentialOwnerUserId = await resolveServerCredentialOwnerUserId(
    request,
    route.p6rServerId,
    db,
  );
  const ownerUserId =
    credentialOwnerUserId ??
    (await resolveOwnerSessionUserId(request, secret, db));
  if (!ownerUserId) return jsonError("forbidden", 403);
  if (credentialOwnerUserId === null) {
    const ownedServer = await db
      .select({ id: server.id })
      .from(server)
      .where(
        and(eq(server.id, route.p6rServerId), eq(server.userId, ownerUserId)),
      )
      .get();
    if (!ownedServer) return jsonError("forbidden", 403);
  }

  if (request.method === "GET") {
    return Response.json(await p6rListServerMembers(db, route.p6rServerId));
  }

  if (request.method === "POST") {
    const body: unknown = await request.json().catch(() => null);
    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !("p6rHandle" in body) ||
      typeof body.p6rHandle !== "string"
    ) {
      return jsonError("invalid_request", 400);
    }
    const result = await p6rAddServerMember(
      db,
      route.p6rServerId,
      ownerUserId,
      body.p6rHandle,
    );
    if (!result.ok) {
      if (result.reason === "unknown-handle") {
        return jsonError("unknown_handle", 404);
      }
      if (result.reason === "already-member") {
        return jsonError("already_member", 409);
      }
      return jsonError("cannot_add_owner", 400);
    }
    return Response.json(result.p6rMember, { status: 201 });
  }

  const removed = await p6rRemoveServerMember(
    db,
    route.p6rServerId,
    ownerUserId,
    route.p6rMemberUserId!,
  );
  return removed
    ? new Response(null, { status: 204 })
    : jsonError("not_found", 404);
}

export async function p6rHandleServerMembers(
  request: Request,
  env: Env,
  route: P6rServerMembersRoute,
): Promise<Response> {
  const db = drizzle(env.DB, { schema });
  return p6rHandleServerMembersWithDb(
    request,
    env.BETTER_AUTH_SECRET,
    db,
    route,
  );
}
