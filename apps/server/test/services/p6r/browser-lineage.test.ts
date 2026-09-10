import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { P6rIdentityBoundaryConfig } from "@bb/config/server";
import {
  getTrustedP6rLineage,
  TRUSTED_REMOTE_ADDRESS_CONTEXT_KEY,
} from "../../../src/request-context.js";
import {
  createP6rBrowserLineage,
  installP6rBrowserLineageMiddleware,
  P6R_BROWSER_LINEAGE_COOKIE,
} from "../../../src/services/p6r/browser-lineage.js";

function cookieFrom(response: Response): string {
  const value = response.headers.get("set-cookie");
  if (value === null) throw new Error("expected a lineage cookie");
  return value.split(";", 1)[0]!;
}

function lineageApp(secret: string) {
  const app = new Hono();
  const lineage = createP6rBrowserLineage({
    generate: (() => {
      let value = 0;
      const prefix = Buffer.from(secret).toString("base64url");
      return () => `${prefix}-${String(++value).padStart(16, "0")}`;
    })(),
    maxAgeMs: 60_000,
    now: () => 1_000,
    secret,
  });
  app.use("/api/v1/plugins/*", async (context, next) => {
    await lineage.establish(context, false);
    return next();
  });
  app.get("/api/v1/plugins/example/rpc/run", (context) =>
    context.text(getTrustedP6rLineage(context) ?? "missing"),
  );
  return app;
}

describe("P6r browser lineage", () => {
  it("keeps one signed cookie jar stable while separating independent jars", async () => {
    const app = lineageApp("proof-secret");
    const first = await app.request("http://proof.test/api/v1/plugins/example/rpc/run");
    const firstCookie = cookieFrom(first);
    const firstLineage = await first.text();
    const second = await app.request("http://proof.test/api/v1/plugins/example/rpc/run", {
      headers: { cookie: firstCookie },
    });
    const independent = await app.request("http://proof.test/api/v1/plugins/example/rpc/run");

    expect(await second.text()).toBe(firstLineage);
    expect(await independent.text()).not.toBe(firstLineage);
  });

  it("rotates tampered and restarted cookie jars", async () => {
    const firstApp = lineageApp("first-secret");
    const first = await firstApp.request("http://proof.test/api/v1/plugins/example/rpc/run");
    const cookie = cookieFrom(first);
    const firstLineage = await first.text();
    const tampered = await firstApp.request("http://proof.test/api/v1/plugins/example/rpc/run", {
      headers: { cookie: `${cookie}tampered` },
    });
    const restartedApp = lineageApp("second-secret");
    const restarted = await restartedApp.request("http://proof.test/api/v1/plugins/example/rpc/run", {
      headers: { cookie },
    });

    expect(await tampered.text()).not.toBe(firstLineage);
    expect(await restarted.text()).not.toBe(firstLineage);
  });

  it("issues host-only HTTP-only lax cookies for plugin RPC paths", async () => {
    const app = lineageApp("proof-secret");
    const response = await app.request("http://proof.test/api/v1/plugins/example/rpc/run");
    const cookie = response.headers.get("set-cookie");

    expect(cookie).toContain(`${P6R_BROWSER_LINEAGE_COOKIE}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/api/v1/plugins");
    expect(cookie).not.toContain("Domain=");
  });

  it("installs cookie lineage only for a configured socket ingress", async () => {
    const boundary: P6rIdentityBoundaryConfig = {
      configuration: {
        boundaryId: "proof-boundary",
        credentials: [],
        ingressIds: ["proof-local"],
        pluginId: "provider",
        resolver: { maxSessionAgeMs: 60_000, timeoutMs: 5_000 },
        version: 1,
      },
      trustedIngresses: [
        {
          authenticatedPeer: "proof-peer",
          id: "proof-local",
          kind: "local",
          remoteAddresses: ["127.0.0.1"],
        },
      ],
    };
    const app = new Hono();
    app.use("*", async (context, next) => {
      context.set(TRUSTED_REMOTE_ADDRESS_CONTEXT_KEY, "127.0.0.1");
      return next();
    });
    installP6rBrowserLineageMiddleware(app, {
      boundary,
      lineage: createP6rBrowserLineage({ secret: "proof-secret" }),
    });
    app.get("/api/v1/plugins/example/rpc/run", (context) =>
      context.text(getTrustedP6rLineage(context) ?? "missing"),
    );

    const response = await app.request("http://proof.test/api/v1/plugins/example/rpc/run");

    expect(await response.text()).not.toBe("missing");
    expect(response.headers.get("set-cookie")).toContain(
      `${P6R_BROWSER_LINEAGE_COOKIE}=`,
    );
  });
});
