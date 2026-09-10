import { randomBytes, randomUUID } from "node:crypto";
import type { P6rIdentityBoundaryConfig } from "@bb/config/server";
import { Hono, type Context } from "hono";
import { getSignedCookie, setSignedCookie } from "hono/cookie";
import {
  getTrustedRemoteAddress,
  setTrustedP6rLineage,
} from "../../request-context.js";

export const P6R_BROWSER_LINEAGE_COOKIE = "bb_p6r_lineage";
export const P6R_NATIVE_HTTP_LINEAGE_COOKIE = "bb_p6r_native_http_lineage";
const DEFAULT_MAX_AGE_MS = 6 * 60 * 60 * 1_000;
const MAX_COOKIE_VALUE_BYTES = 160;

export interface P6rBrowserLineage {
  establish(context: Context, secure: boolean): Promise<string>;
  restore(context: Context): Promise<string | null>;
}

export interface P6rBrowserLineageOptions {
  readonly cookieName?: string;
  readonly cookiePath?: string;
  readonly generate?: () => string;
  readonly maxAgeMs?: number;
  readonly now?: () => number;
  readonly secret?: string;
}

export interface P6rBrowserLineageMiddlewareOptions {
  readonly boundary: P6rIdentityBoundaryConfig;
  readonly lineage?: P6rBrowserLineage;
}

function parseLineage(value: string, now: number): string | null {
  if (Buffer.byteLength(value, "utf8") > MAX_COOKIE_VALUE_BYTES) return null;
  const separator = value.indexOf(".");
  if (separator < 1) return null;
  const expiresAt = Number(value.slice(0, separator));
  const lineage = value.slice(separator + 1);
  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= now ||
    !/^[a-zA-Z0-9_-]{16,96}$/u.test(lineage)
  ) {
    return null;
  }
  return lineage;
}

export function createP6rBrowserLineage(
  options: P6rBrowserLineageOptions = {},
): P6rBrowserLineage {
  const now = options.now ?? Date.now;
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const cookieName = options.cookieName ?? P6R_BROWSER_LINEAGE_COOKIE;
  const cookiePath = options.cookiePath ?? "/api/v1/plugins";
  const generate = options.generate ?? (() => randomUUID().replaceAll("-", ""));
  const secret = options.secret ?? randomBytes(32).toString("base64url");
  if (!Number.isSafeInteger(maxAgeMs) || maxAgeMs <= 0) {
    throw new Error("P6r browser lineage maxAgeMs must be a positive integer");
  }
  return {
    async establish(context, secure) {
      const current = now();
      const signed = await getSignedCookie(context, secret, cookieName);
      const existing =
        typeof signed === "string" ? parseLineage(signed, current) : null;
      const lineage = existing ?? generate();
      if (existing === null) {
        const expiresAt = current + maxAgeMs;
        await setSignedCookie(
          context,
          cookieName,
          `${expiresAt}.${lineage}`,
          secret,
          {
            expires: new Date(expiresAt),
            httpOnly: true,
            maxAge: Math.ceil(maxAgeMs / 1_000),
            path: cookiePath,
            sameSite: "Lax",
            secure,
          },
        );
      }
      setTrustedP6rLineage(context, lineage);
      return lineage;
    },
    async restore(context) {
      const signed = await getSignedCookie(context, secret, cookieName);
      const lineage =
        typeof signed === "string" ? parseLineage(signed, now()) : null;
      setTrustedP6rLineage(context, lineage ?? undefined);
      return lineage;
    },
  };
}

export function installP6rBrowserLineageMiddleware(
  app: Hono,
  options: P6rBrowserLineageMiddlewareOptions,
): void {
  const lineage = options.lineage ?? createP6rBrowserLineage();
  app.use("/api/v1/plugins/*", async (context, next) => {
    const remoteAddress = getTrustedRemoteAddress(context);
    const trustedIngress = options.boundary.trustedIngresses.find((candidate) =>
      candidate.remoteAddresses.includes(remoteAddress ?? ""),
    );
    if (trustedIngress !== undefined) {
      await lineage.establish(context, trustedIngress.kind === "owned-proxy");
    }
    return next();
  });
}

function isNativeHttpIdentityRoute(context: Context): boolean {
  if (
    context.req.method === "GET" &&
    context.req.path === "/api/v1/system/native-identity"
  ) {
    return true;
  }
  return (
    (context.req.method === "POST" ||
      context.req.method === "PATCH" ||
      context.req.method === "DELETE") &&
    context.req.path.startsWith("/api/v1/threads/")
  );
}

export function installP6rNativeHttpLineageMiddleware(
  app: Hono,
  options: P6rBrowserLineageMiddlewareOptions,
): void {
  const lineage =
    options.lineage ??
    createP6rBrowserLineage({
      cookieName: P6R_NATIVE_HTTP_LINEAGE_COOKIE,
      cookiePath: "/",
    });
  app.use("/api/v1/*", async (context, next) => {
    if (!isNativeHttpIdentityRoute(context)) return next();
    const remoteAddress = getTrustedRemoteAddress(context);
    const trustedIngress = options.boundary.trustedIngresses.find((candidate) =>
      candidate.remoteAddresses.includes(remoteAddress ?? ""),
    );
    if (trustedIngress !== undefined) {
      await lineage.establish(context, trustedIngress.kind === "owned-proxy");
    }
    return next();
  });
}
