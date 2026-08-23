import { getPluginKvValue } from "@bb/db";
import { p6rNormalizeHandle } from "@bb/domain";
import {
  p6rMemberListResponseSchema,
  p6rMemberSchema,
  publicApiRoutes,
  typedRoutes,
  type P6rMember,
  type PublicApiSchema,
} from "@bb/server-contract";
import type { Hono } from "hono";
import { z } from "zod";
import { ApiError } from "../errors.js";
import type { AppDeps } from "../types.js";

const CONNECT_PLUGIN_ID = "connect";
const CONNECT_CREDENTIAL_KEY = "credential";
const P6R_TUNNEL_ORIGIN_HEADER = "x-p6r-via-tunnel";

const connectCredentialSchema = z
  .object({
    serverUrl: z.string().url(),
    handle: z.string().min(1),
    credential: z.string().min(1),
  })
  .strict();

const accountServersResponseSchema = z
  .object({
    servers: z.array(
      z.object({
        id: z.string().min(1),
        handle: z.string().min(1),
      }),
    ),
  })
  .strict();

const workerMemberSchema = z
  .object({
    p6rUserId: z.string().min(1),
    p6rHandle: z.string().min(1),
    p6rName: z.string().min(1),
    p6rImage: z.string().nullable(),
    p6rAddedByUserId: z.string().min(1),
    p6rCreatedAt: z.number().int().nonnegative(),
  })
  .strict();

interface MemberProxyTarget {
  credential: string;
  memberApiUrl: string;
}

function assertOwnerConsoleRequest(request: Request): void {
  if (request.headers.has(P6R_TUNNEL_ORIGIN_HEADER)) {
    throw new ApiError(
      403,
      "member_management_tunnel_forbidden",
      "Member management is available only from the owner's local console",
    );
  }
}

function readConnectCredential(deps: AppDeps) {
  const stored = getPluginKvValue(
    deps.db,
    CONNECT_PLUGIN_ID,
    CONNECT_CREDENTIAL_KEY,
  );
  if (stored === undefined) {
    throw new ApiError(
      404,
      "connect_not_enrolled",
      "This bb is not enrolled in Connect; pair it before managing members",
    );
  }
  let raw: unknown;
  try {
    raw = JSON.parse(stored);
  } catch {
    throw new ApiError(
      404,
      "connect_not_enrolled",
      "This bb has no valid Connect enrollment",
    );
  }
  const parsed = connectCredentialSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError(
      404,
      "connect_not_enrolled",
      "This bb has no valid Connect enrollment",
    );
  }
  return parsed.data;
}

async function jsonFromWorker(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ApiError(
      502,
      "connect_invalid_response",
      "Connect returned an invalid response",
    );
  }
}

function workerErrorCode(raw: unknown): string | null {
  if (
    typeof raw === "object" &&
    raw !== null &&
    "error" in raw &&
    typeof raw.error === "string"
  ) {
    return raw.error;
  }
  return null;
}

async function throwWorkerError(
  response: Response,
  p6rHandle?: string,
): Promise<never> {
  const raw = await jsonFromWorker(response);
  const code = workerErrorCode(raw);
  if (response.status === 403) {
    throw new ApiError(
      403,
      "member_management_forbidden",
      "Connect rejected member management for this server",
    );
  }
  if (response.status === 404 && code === "unknown_handle") {
    throw new ApiError(
      404,
      "unknown_handle",
      `No Connect account has the p6rHandle '${p6rHandle ?? ""}'`,
    );
  }
  if (response.status === 404) {
    throw new ApiError(404, "member_not_found", "Member not found");
  }
  if (response.status === 409 && code === "already_member") {
    throw new ApiError(
      409,
      "already_member",
      `The p6rHandle '${p6rHandle ?? ""}' is already a member`,
    );
  }
  throw new ApiError(
    response.status === 400
      ? 400
      : response.status === 401
        ? 401
        : response.status === 405
          ? 405
          : 502,
    code ?? "connect_request_failed",
    `Connect member request failed (${response.status})`,
  );
}

async function fetchWorker(
  input: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    throw new ApiError(
      502,
      "connect_unreachable",
      `Connect is unreachable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function resolveMemberProxyTarget(
  deps: AppDeps,
): Promise<MemberProxyTarget> {
  const enrollment = readConnectCredential(deps);
  const serverUrl = enrollment.serverUrl.replace(/\/+$/u, "");
  const response = await fetchWorker(`${serverUrl}/api/connect/servers`, {
    headers: { "x-bb-connect-machine": enrollment.credential },
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(
        403,
        "connect_enrollment_rejected",
        "Connect rejected this bb's enrollment credential",
      );
    }
    await throwWorkerError(response);
  }
  const parsed = accountServersResponseSchema.safeParse(
    await jsonFromWorker(response),
  );
  if (!parsed.success) {
    throw new ApiError(
      502,
      "connect_invalid_response",
      "Connect returned an invalid server identity response",
    );
  }
  const ownServer = parsed.data.servers.find(
    (server) => server.handle === enrollment.handle,
  );
  if (!ownServer) {
    throw new ApiError(
      404,
      "connect_not_enrolled",
      "This bb's Connect enrollment no longer identifies a server",
    );
  }
  return {
    credential: enrollment.credential,
    memberApiUrl: `${serverUrl}/api/p6r-servers/${encodeURIComponent(ownServer.id)}/p6r-members`,
  };
}

function memberFromWorker(raw: unknown): P6rMember {
  const member = workerMemberSchema.safeParse(raw);
  if (!member.success) {
    throw new ApiError(
      502,
      "connect_invalid_response",
      "Connect returned an invalid member",
    );
  }
  return p6rMemberSchema.parse({
    p6rUserId: member.data.p6rUserId,
    p6rHandle: member.data.p6rHandle,
    p6rDisplayName: member.data.p6rName,
    p6rImageUrl: member.data.p6rImage,
    p6rAddedByUserId: member.data.p6rAddedByUserId,
    p6rCreatedAt: member.data.p6rCreatedAt,
  });
}

async function listMembers(target: MemberProxyTarget): Promise<P6rMember[]> {
  const response = await fetchWorker(target.memberApiUrl, {
    headers: { authorization: `Bearer ${target.credential}` },
  });
  if (!response.ok) await throwWorkerError(response);
  const raw = await jsonFromWorker(response);
  if (!Array.isArray(raw)) {
    throw new ApiError(
      502,
      "connect_invalid_response",
      "Connect returned an invalid member list",
    );
  }
  return raw.map(memberFromWorker);
}

export function p6rRegisterMemberRoutes(app: Hono, deps: AppDeps): void {
  const { del, get, post } = typedRoutes<PublicApiSchema>(app, {
    onValidationError: (message) =>
      new ApiError(400, "invalid_request", message),
  });

  get(publicApiRoutes.p6rMembers.p6rList, async (context) => {
    assertOwnerConsoleRequest(context.req.raw);
    const members = await listMembers(await resolveMemberProxyTarget(deps));
    return context.json(
      p6rMemberListResponseSchema.parse({ p6rMembers: members }),
    );
  });

  post(publicApiRoutes.p6rMembers.p6rAdd, async (context, input) => {
    assertOwnerConsoleRequest(context.req.raw);
    const target = await resolveMemberProxyTarget(deps);
    const response = await fetchWorker(target.memberApiUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${target.credential}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ p6rHandle: p6rNormalizeHandle(input.p6rHandle) }),
    });
    if (!response.ok) await throwWorkerError(response, input.p6rHandle);
    return context.json(memberFromWorker(await jsonFromWorker(response)), 201);
  });

  del(publicApiRoutes.p6rMembers.p6rRemove, async (context, input) => {
    assertOwnerConsoleRequest(context.req.raw);
    const target = await resolveMemberProxyTarget(deps);
    const normalizedHandle = p6rNormalizeHandle(input.p6rHandle);
    const member = (await listMembers(target)).find(
      (candidate) =>
        p6rNormalizeHandle(candidate.p6rHandle) === normalizedHandle,
    );
    if (!member) {
      throw new ApiError(
        404,
        "unknown_handle",
        `The p6rHandle '${input.p6rHandle}' is not a member`,
      );
    }
    const response = await fetchWorker(
      `${target.memberApiUrl}/${encodeURIComponent(member.p6rUserId)}`,
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${target.credential}` },
      },
    );
    if (!response.ok) await throwWorkerError(response, input.p6rHandle);
    return context.json({ ok: true });
  });
}
