import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  auditLog,
  profile,
  schema,
  server,
  p6rServerMember,
  session,
  user,
} from "@bb/connect-db";

import {
  p6rAddServerMember,
  p6rAdmitServerMember,
  p6rHandleServerMembersWithDb,
  p6rMatchServerMembersRoute,
  p6rRemoveServerMember,
} from "./members.js";

const MIGRATIONS_DIR = fileURLToPath(
  new URL("../../../packages/connect-db/migrations", import.meta.url),
);
const SECRET = "member-api-test-secret";
const NOW = new Date("2026-07-18T12:00:00.000Z");

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;
let sessionOrdinal = 0;

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

beforeEach(() => {
  sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
    if (!file.endsWith(".sql")) continue;
    sqlite.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
  db = drizzle(sqlite, { schema });
});

afterEach(() => {
  sqlite.close();
});

function seedUser(values: {
  id: string;
  handle: string;
  name?: string;
  image?: string | null;
}): void {
  db.insert(user)
    .values({
      id: values.id,
      name: values.name ?? values.id,
      email: `${values.id}@example.com`,
      emailVerified: true,
      image: values.image ?? null,
      createdAt: NOW,
      updatedAt: NOW,
    })
    .run();
  db.insert(profile)
    .values({ userId: values.id, handle: values.handle, createdAt: NOW })
    .run();
}

function seedServer(
  id: string,
  ownerUserId: string,
  subdomain = "owner",
  credentialHash = "hash",
  name = "default",
): void {
  db.insert(server)
    .values({
      id,
      userId: ownerUserId,
      name,
      subdomain,
      credentialHash,
      createdAt: NOW,
    })
    .run();
}

async function sessionRequest(
  userId: string,
  url: string,
  init: RequestInit = {},
): Promise<Request> {
  sessionOrdinal += 1;
  const token = `member_session_${sessionOrdinal}_${userId}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(token),
  );
  const encodedSignature = btoa(
    String.fromCharCode(...new Uint8Array(signature)),
  );
  db.insert(session)
    .values({
      id: `session-${sessionOrdinal}`,
      token,
      expiresAt: new Date(Date.now() + 60_000),
      userId,
      createdAt: NOW,
      updatedAt: NOW,
    })
    .run();
  const headers = new Headers(init.headers);
  headers.set(
    "cookie",
    `__Secure-better-auth.session_token=${encodeURIComponent(`${token}.${encodedSignature}`)}`,
  );
  return new Request(url, { ...init, headers });
}

function route(serverId: string, memberUserId: string | null = null) {
  return { p6rServerId: serverId, p6rMemberUserId: memberUserId };
}

describe("server member route parsing", () => {
  it("matches collection and item paths exactly", () => {
    expect(
      p6rMatchServerMembersRoute("/api/p6r-servers/srv-1/p6r-members"),
    ).toEqual({
      p6rServerId: "srv-1",
      p6rMemberUserId: null,
    });
    expect(
      p6rMatchServerMembersRoute("/api/p6r-servers/srv-1/p6r-members/user%2D2"),
    ).toEqual({ p6rServerId: "srv-1", p6rMemberUserId: "user-2" });
    expect(
      p6rMatchServerMembersRoute(
        "/api/p6r-servers/srv-1/p6r-members/extra/path",
      ),
    ).toBeNull();
  });
});

describe("owner member-management API", () => {
  beforeEach(() => {
    seedUser({ id: "owner-user", handle: "owner", name: "Owner" });
    seedUser({
      id: "member-user",
      handle: "invited",
      name: "Invited User",
      image: "https://example.com/avatar.png",
    });
    seedUser({ id: "other-user", handle: "other", name: "Other User" });
    seedServer("server-1", "owner-user");
  });

  it.each([
    ["GET", null, undefined],
    ["POST", null, JSON.stringify({ p6rHandle: "invited" })],
    ["DELETE", "member-user", undefined],
  ] as const)(
    "returns 403 when a non-owner session calls %s",
    async (method, memberUserId, body) => {
      const request = await sessionRequest(
        "other-user",
        `https://getbb.app/api/p6r-servers/server-1/p6r-members${memberUserId ? `/${memberUserId}` : ""}`,
        {
          method,
          headers: body ? { "content-type": "application/json" } : undefined,
          body,
        },
      );
      const response = await p6rHandleServerMembersWithDb(
        request,
        SECRET,
        db,
        route("server-1", memberUserId),
      );
      expect(response.status).toBe(403);
    },
  );

  it("returns 403 without an owner session", async () => {
    const response = await p6rHandleServerMembersWithDb(
      new Request("https://getbb.app/api/p6r-servers/server-1/p6r-members"),
      SECRET,
      db,
      route("server-1"),
    );
    expect(response.status).toBe(403);
  });

  it("accepts the same server's tunnel credential across member management", async () => {
    const credential = "bbcred_server_one";
    db.update(server)
      .set({ credentialHash: await sha256Hex(credential) })
      .where(eq(server.id, "server-1"))
      .run();

    const added = await p6rHandleServerMembersWithDb(
      new Request("https://getbb.app/api/p6r-servers/server-1/p6r-members", {
        method: "POST",
        headers: { authorization: `Bearer ${credential}` },
        body: JSON.stringify({ p6rHandle: "invited" }),
      }),
      SECRET,
      db,
      route("server-1"),
    );
    expect(added.status).toBe(201);

    const listed = await p6rHandleServerMembersWithDb(
      new Request("https://getbb.app/api/p6r-servers/server-1/p6r-members", {
        headers: { authorization: `Bearer ${credential}` },
      }),
      SECRET,
      db,
      route("server-1"),
    );
    expect(listed.status).toBe(200);
    await expect(listed.json()).resolves.toEqual([
      expect.objectContaining({
        p6rUserId: "member-user",
        p6rHandle: "invited",
      }),
    ]);

    const removed = await p6rHandleServerMembersWithDb(
      new Request(
        "https://getbb.app/api/p6r-servers/server-1/p6r-members/member-user",
        {
          method: "DELETE",
          headers: { authorization: `Bearer ${credential}` },
        },
      ),
      SECRET,
      db,
      route("server-1", "member-user"),
    );
    expect(removed.status).toBe(204);
  });

  it("rejects a wrong tunnel credential", async () => {
    const response = await p6rHandleServerMembersWithDb(
      new Request("https://getbb.app/api/p6r-servers/server-1/p6r-members", {
        headers: { authorization: "Bearer wrong" },
      }),
      SECRET,
      db,
      route("server-1"),
    );

    expect(response.status).toBe(403);
  });

  it("cannot use one server credential to manage another server", async () => {
    const credential = "bbcred_server_one";
    db.update(server)
      .set({ credentialHash: await sha256Hex(credential) })
      .where(eq(server.id, "server-1"))
      .run();
    seedServer(
      "server-2",
      "owner-user",
      "owner-two",
      "different-hash",
      "second",
    );

    const response = await p6rHandleServerMembersWithDb(
      new Request("https://getbb.app/api/p6r-servers/server-2/p6r-members", {
        headers: { authorization: `Bearer ${credential}` },
      }),
      SECRET,
      db,
      route("server-2"),
    );

    expect(response.status).toBe(403);
  });

  it("adds, lists, and removes a member with owner-attributed audit rows", async () => {
    const addRequest = await sessionRequest(
      "owner-user",
      "https://getbb.app/api/p6r-servers/server-1/p6r-members",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ p6rHandle: "  INVITED  " }),
      },
    );
    const added = await p6rHandleServerMembersWithDb(
      addRequest,
      SECRET,
      db,
      route("server-1"),
    );
    expect(added.status).toBe(201);
    await expect(added.json()).resolves.toMatchObject({
      p6rUserId: "member-user",
      p6rHandle: "invited",
      p6rName: "Invited User",
      p6rImage: "https://example.com/avatar.png",
      p6rAddedByUserId: "owner-user",
      p6rCreatedAt: expect.any(Number),
    });

    const listRequest = await sessionRequest(
      "owner-user",
      "https://getbb.app/api/p6r-servers/server-1/p6r-members",
    );
    const listed = await p6rHandleServerMembersWithDb(
      listRequest,
      SECRET,
      db,
      route("server-1"),
    );
    expect(listed.status).toBe(200);
    await expect(listed.json()).resolves.toEqual([
      expect.objectContaining({
        p6rUserId: "member-user",
        p6rHandle: "invited",
        p6rAddedByUserId: "owner-user",
      }),
    ]);

    const removeRequest = await sessionRequest(
      "owner-user",
      "https://getbb.app/api/p6r-servers/server-1/p6r-members/member-user",
      { method: "DELETE" },
    );
    const removed = await p6rHandleServerMembersWithDb(
      removeRequest,
      SECRET,
      db,
      route("server-1", "member-user"),
    );
    expect(removed.status).toBe(204);
    expect(
      db
        .select()
        .from(p6rServerMember)
        .where(eq(p6rServerMember.p6rServerId, "server-1"))
        .all(),
    ).toEqual([]);

    const auditRows = db
      .select({
        userId: auditLog.userId,
        action: auditLog.action,
        detail: auditLog.detail,
      })
      .from(auditLog)
      .all();
    expect(auditRows).toEqual([
      {
        userId: "owner-user",
        action: "member-added",
        detail: JSON.stringify({
          p6rServerId: "server-1",
          p6rMemberUserId: "member-user",
        }),
      },
      {
        userId: "owner-user",
        action: "member-removed",
        detail: JSON.stringify({
          p6rServerId: "server-1",
          p6rMemberUserId: "member-user",
        }),
      },
    ]);
  });

  it("returns 404 for an unknown handle", async () => {
    const request = await sessionRequest(
      "owner-user",
      "https://getbb.app/api/p6r-servers/server-1/p6r-members",
      {
        method: "POST",
        body: JSON.stringify({ p6rHandle: "missing" }),
      },
    );
    const response = await p6rHandleServerMembersWithDb(
      request,
      SECRET,
      db,
      route("server-1"),
    );
    expect(response.status).toBe(404);
  });

  it("returns 409 when the profile is already a member", async () => {
    db.insert(p6rServerMember)
      .values({
        p6rServerId: "server-1",
        p6rUserId: "member-user",
        p6rAddedByUserId: "owner-user",
        p6rCreatedAt: NOW,
      })
      .run();
    const request = await sessionRequest(
      "owner-user",
      "https://getbb.app/api/p6r-servers/server-1/p6r-members",
      {
        method: "POST",
        body: JSON.stringify({ p6rHandle: "invited" }),
      },
    );
    const response = await p6rHandleServerMembersWithDb(
      request,
      SECRET,
      db,
      route("server-1"),
    );
    expect(response.status).toBe(409);
  });

  it("returns 400 when the normalized handle belongs to the owner", async () => {
    const request = await sessionRequest(
      "owner-user",
      "https://getbb.app/api/p6r-servers/server-1/p6r-members",
      {
        method: "POST",
        body: JSON.stringify({ p6rHandle: "  OWNER " }),
      },
    );
    const response = await p6rHandleServerMembersWithDb(
      request,
      SECRET,
      db,
      route("server-1"),
    );
    expect(response.status).toBe(400);
  });

  it("returns 404 when deleting an absent member", async () => {
    const request = await sessionRequest(
      "owner-user",
      "https://getbb.app/api/p6r-servers/server-1/p6r-members/member-user",
      { method: "DELETE" },
    );
    const response = await p6rHandleServerMembersWithDb(
      request,
      SECRET,
      db,
      route("server-1", "member-user"),
    );
    expect(response.status).toBe(404);
  });

  it("rolls back an added member when its audit insert fails", async () => {
    sqlite.exec("DROP TABLE audit_log");

    await expect(
      p6rAddServerMember(db, "server-1", "owner-user", "invited", NOW),
    ).rejects.toThrow(/audit_log/iu);
    expect(
      db
        .select()
        .from(p6rServerMember)
        .where(eq(p6rServerMember.p6rServerId, "server-1"))
        .all(),
    ).toEqual([]);
  });

  it("rolls back a removed member when its audit insert fails", async () => {
    db.insert(p6rServerMember)
      .values({
        p6rServerId: "server-1",
        p6rUserId: "member-user",
        p6rAddedByUserId: "owner-user",
        p6rCreatedAt: NOW,
      })
      .run();
    sqlite.exec("DROP TABLE audit_log");

    await expect(
      p6rRemoveServerMember(db, "server-1", "owner-user", "member-user", NOW),
    ).rejects.toThrow(/audit_log/iu);
    expect(
      db
        .select({ userId: p6rServerMember.p6rUserId })
        .from(p6rServerMember)
        .where(eq(p6rServerMember.p6rServerId, "server-1"))
        .all(),
    ).toEqual([{ userId: "member-user" }]);
  });
});

describe("member gate admission audit", () => {
  it("admits only a matching member and debounces the durable audit row", async () => {
    seedUser({ id: "audit-owner", handle: "audit-owner" });
    seedUser({ id: "audit-member", handle: "audit-member" });
    seedUser({ id: "audit-other", handle: "audit-other" });
    seedServer("audit-server", "audit-owner", "audit-bb");
    db.insert(p6rServerMember)
      .values({
        p6rServerId: "audit-server",
        p6rUserId: "audit-member",
        p6rAddedByUserId: "audit-owner",
        p6rCreatedAt: NOW,
      })
      .run();

    await expect(
      p6rAdmitServerMember(
        db,
        "audit-server",
        "audit-other",
        "audit-bb",
        NOW.getTime(),
      ),
    ).resolves.toBe(false);
    await expect(
      Promise.all([
        p6rAdmitServerMember(
          db,
          "audit-server",
          "audit-member",
          "audit-bb",
          NOW.getTime(),
        ),
        p6rAdmitServerMember(
          db,
          "audit-server",
          "audit-member",
          "audit-bb",
          NOW.getTime(),
        ),
      ]),
    ).resolves.toEqual([true, true]);
    await expect(
      p6rAdmitServerMember(
        db,
        "audit-server",
        "audit-member",
        "audit-bb",
        NOW.getTime() + 14 * 60_000,
      ),
    ).resolves.toBe(true);

    const rows = db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.action, "member-admitted"),
          eq(auditLog.userId, "audit-member"),
        ),
      )
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0].detail).toBe(
      JSON.stringify({
        p6rServerId: "audit-server",
        p6rSubdomain: "audit-bb",
      }),
    );
  });
});
