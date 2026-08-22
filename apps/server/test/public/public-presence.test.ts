import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { networkInterfaces } from "node:os";
import WebSocket from "ws";
import {
  P6R_CLAIMED_IDENTITY_HEADER,
  p6rEncodeClaimedIdentityHeader,
  p6rPrincipalKeySchema,
} from "@bb/domain";
import { p6rPresenceSnapshotResponseSchema } from "@bb/server-contract";
import { describe, expect, it } from "vitest";
import { p6rRegisterSocketActor } from "../../src/ws/socket-actors.js";
import { p6rCreateLocalOperatorIdentity } from "../../src/services/actors.js";
import { createMockHubSocket } from "../helpers/mock-hub-socket.js";
import { readJson } from "../helpers/json.js";
import {
  startTestServer,
  withTestHarness,
  type RunningTestServer,
} from "../helpers/test-app.js";

const TAILNET_PROVIDER_SOURCE = `
  export default function plugin(bb) {
    bb.p6rIdentity.registerProvider({
      id: "p6r-tailnet",
      resolve: () => ({
        kind: "authenticated",
        p6rSubject: "tailnet-acct-42",
        p6rHandle: "shared-human",
        p6rDisplayName: "Shared Human",
        p6rImageUrl: "https://example.test/shared-human.png",
      }),
    });
  }
`;

async function installTailnetProvider(
  server: RunningTestServer,
): Promise<void> {
  const rootDir = join(
    server.config.dataDir,
    "fixtures",
    "bb-plugin-p6r-tailnet",
  );
  await mkdir(rootDir, { recursive: true });
  await writeFile(
    join(rootDir, "package.json"),
    JSON.stringify({
      name: "bb-plugin-p6r-tailnet",
      version: "0.1.0",
      bb: {
        name: "p6r Tailnet identity fixture",
        description: "Configured p6r Tailnet identity provider fixture.",
        branding: { icon: "Zap" },
        server: "./server.ts",
      },
    }),
  );
  await writeFile(join(rootDir, "server.ts"), TAILNET_PROVIDER_SOURCE);
  const entry = await server.pluginService.installPath(rootDir);
  expect(entry.status).toBe("running");
}

function websocketUrl(baseUrl: string): string {
  const url = new URL("/ws", baseUrl);
  url.protocol = "ws:";
  return url.href;
}

function nonLoopbackIpv4Address(): string {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) {
        return address.address;
      }
    }
  }
  throw new Error("public no-provider presence test requires a non-loopback IPv4 address");
}

async function openIdentitySocket(
  server: RunningTestServer,
  p6rClientClaim = p6rEncodeClaimedIdentityHeader({
    p6rHandle: "spoofed",
    p6rDisplayName: "Spoofed",
    p6rImageUrl: null,
    p6rClientId: "spoof-client",
    p6rPrincipalKey: p6rPrincipalKeySchema.parse("spoof:client"),
  }),
): Promise<WebSocket> {
  return await new Promise((resolve, reject) => {
    const socket = new WebSocket(websocketUrl(server.baseUrl), {
      origin: server.baseUrl,
      headers: { [P6R_CLAIMED_IDENTITY_HEADER]: p6rClientClaim },
    });
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  });
}

async function openClaimedIdentitySocket(
  server: RunningTestServer,
): Promise<WebSocket> {
  return await new Promise((resolve, reject) => {
    const socket = new WebSocket(websocketUrl(server.baseUrl), {
      origin: server.baseUrl,
    });
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  });
}

async function subscribeToThread(socket: WebSocket): Promise<void> {
  socket.send(
    JSON.stringify({
      type: "subscribe",
      target: { kind: "thread-detail", threadId: "thread-1" },
    }),
  );
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function closeIdentitySocket(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.CLOSED) return;
  await new Promise<void>((resolve) => {
    socket.once("close", resolve);
    socket.close();
  });
}

describe("GET /api/v1/p6r-presence", () => {
  it("returns the current hub-derived viewer snapshot", async () => {
    await withTestHarness(async (harness) => {
      const socket = createMockHubSocket();
      p6rRegisterSocketActor(socket, {
        p6rHandle: "sawyer",
        p6rDisplayName: "Sawyer",
        p6rImageUrl: null,
        p6rClientId: "browser-1",
      });
      harness.hub.subscribe(socket, {
        kind: "thread-detail",
        threadId: "thread-1",
      });

      const response = await harness.app.request("/api/v1/p6r-presence");
      expect(response.status).toBe(200);
      expect(
        p6rPresenceSnapshotResponseSchema.parse(await readJson(response)),
      ).toEqual({
        p6rThreads: {
          "thread-1": [
            {
              p6rHandle: "sawyer",
              p6rDisplayName: "Sawyer",
              p6rImageUrl: null,
              p6rTyping: false,
            },
          ],
        },
      });
    });
  });

  it("derives the stock no-IdP PrincipalKey through the public WebSocket seam", async () => {
    const server = await startTestServer();
    try {
      const socket = await openIdentitySocket(server);
      await subscribeToThread(socket);

      const response = await server.app.request("/api/v1/p6r-presence");
      expect(response.status).toBe(200);
      const localOperator = p6rCreateLocalOperatorIdentity();
      expect(
        p6rPresenceSnapshotResponseSchema.parse(await response.json()),
      ).toMatchObject({
        p6rThreads: {
          "thread-1": [
            {
              p6rPrincipalKey: localOperator.p6rPrincipalKey,
              p6rHandle: localOperator.p6rHandle,
              p6rDisplayName: localOperator.p6rDisplayName,
              p6rImageUrl: null,
              p6rTyping: false,
            },
          ],
        },
      });
      await closeIdentitySocket(socket);
    } finally {
      await server.close();
    }
  });

  it("derives the configured p6r Tailnet PrincipalKey and strips a client spoof", async () => {
    const server = await startTestServer();
    try {
      await installTailnetProvider(server);
      const socket = await openIdentitySocket(server);
      await subscribeToThread(socket);

      const response = await server.app.request("/api/v1/p6r-presence");
      expect(response.status).toBe(200);
      expect(
        p6rPresenceSnapshotResponseSchema.parse(await response.json()),
      ).toMatchObject({
        p6rThreads: {
          "thread-1": [
            {
              p6rPrincipalKey: "p6r:p6r-tailnet%2Fp6r-tailnet/tailnet-acct-42",
              p6rHandle: "shared-human",
              p6rDisplayName: "Shared Human",
              p6rImageUrl: "https://example.test/shared-human.png",
              p6rTyping: false,
            },
          ],
        },
      });
      await closeIdentitySocket(socket);
    } finally {
      await server.close();
    }
  });

  it("keeps loopback WebSockets on the local operator despite client claims", async () => {
    const server = await startTestServer();
    try {
      const alice = await openClaimedIdentitySocket(server);
      const bob = await openClaimedIdentitySocket(server);
      const claim = (args: {
        p6rHandle: string;
        p6rDisplayName: string;
        p6rClientId: string;
      }) =>
        JSON.stringify({
          type: "p6r-claimed-identity",
          p6rClaimedIdentity: {
            ...args,
            p6rImageUrl: null,
          },
        });

      alice.send(
        claim({
          p6rHandle: "alice",
          p6rDisplayName: "Alice",
          p6rClientId: "alice-browser",
        }),
      );
      await subscribeToThread(alice);
      bob.send(
        claim({
          p6rHandle: "bob",
          p6rDisplayName: "Bob",
          p6rClientId: "bob-browser",
        }),
      );
      await subscribeToThread(bob);

      const response = await server.app.request("/api/v1/p6r-presence");
      expect(response.status).toBe(200);
      const viewers = p6rPresenceSnapshotResponseSchema.parse(
        await response.json(),
      ).p6rThreads["thread-1"];
      const localOperator = p6rCreateLocalOperatorIdentity();
      expect(viewers).toEqual([
        {
          p6rPrincipalKey: localOperator.p6rPrincipalKey,
          p6rHandle: localOperator.p6rHandle,
          p6rDisplayName: localOperator.p6rDisplayName,
          p6rImageUrl: null,
          p6rTyping: false,
        },
      ]);
      await closeIdentitySocket(alice);
      await closeIdentitySocket(bob);
    } finally {
      await server.close();
    }
  });

  it("keeps remote no-provider claimed identities distinct with server-authored PrincipalKeys", async () => {
    const connectHost = nonLoopbackIpv4Address();
    const server = await startTestServer({
      testServerListenHost: "0.0.0.0",
      testServerConnectHost: connectHost,
    });
    try {
      const alice = await openClaimedIdentitySocket(server);
      const bob = await openClaimedIdentitySocket(server);
      const claim = (args: {
        p6rHandle: string;
        p6rDisplayName: string;
        p6rClientId: string;
      }) =>
        JSON.stringify({
          type: "p6r-claimed-identity",
          p6rClaimedIdentity: {
            ...args,
            p6rImageUrl: null,
          },
        });

      alice.send(
        claim({
          p6rHandle: "shared",
          p6rDisplayName: "Shared Human",
          p6rClientId: "alice-browser",
        }),
      );
      await subscribeToThread(alice);
      bob.send(
        claim({
          p6rHandle: "shared",
          p6rDisplayName: "Shared Human",
          p6rClientId: "bob-browser",
        }),
      );
      await subscribeToThread(bob);

      const response = await fetch(
        new URL("/api/v1/p6r-presence", server.baseUrl),
      );
      expect(response.status).toBe(200);
      const viewers = p6rPresenceSnapshotResponseSchema.parse(
        await response.json(),
      ).p6rThreads["thread-1"];
      expect(viewers).toHaveLength(2);
      expect(viewers.map((viewer) => viewer.p6rPrincipalKey)).toEqual([
        expect.stringMatching(/^claimed:/u),
        expect.stringMatching(/^claimed:/u),
      ]);
      expect(viewers[0]?.p6rPrincipalKey).not.toBe(
        viewers[1]?.p6rPrincipalKey,
      );
      expect(viewers).toMatchObject([
        { p6rHandle: "shared", p6rDisplayName: "Shared Human" },
        { p6rHandle: "shared", p6rDisplayName: "Shared Human" },
      ]);

      await closeIdentitySocket(alice);
      await closeIdentitySocket(bob);
    } finally {
      await server.close();
    }
  });

  it("rejects a client-chosen PrincipalKey on the public WebSocket seam", async () => {
    const server = await startTestServer();
    try {
      const socket = await openClaimedIdentitySocket(server);
      const close = new Promise<number>((resolve) => {
        socket.once("close", (code) => resolve(code));
      });
      socket.send(
        JSON.stringify({
          type: "p6r-claimed-identity",
          p6rClaimedIdentity: {
            p6rHandle: "spoofed",
            p6rDisplayName: "Spoofed",
            p6rImageUrl: null,
            p6rClientId: "spoof-client",
            p6rPrincipalKey: "claimed:spoofed",
          },
        }),
      );
      await expect(close).resolves.toBe(1008);
    } finally {
      await server.close();
    }
  });
});
