import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import {
  startTestServer,
  type RunningTestServer,
} from "../../helpers/test-app.js";

let server: RunningTestServer | null = null;

function websocketUrl(baseUrl: string): string {
  const url = new URL("/ws/threads/thread-1/presence", baseUrl);
  url.protocol = "ws:";
  return url.href;
}

function rejectedWebSocketStatus(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.once("open", () => reject(new Error("presence socket opened")));
    socket.once("unexpected-response", (_request, response) => {
      const status = response.statusCode;
      response.resume();
      if (status === undefined) {
        reject(new Error("presence socket rejection omitted HTTP status"));
        return;
      }
      resolve(status);
    });
    socket.once("error", () => {});
  });
}

afterEach(async () => {
  if (server !== null) {
    await server.close();
    server = null;
  }
});

describe("native thread presence websocket", () => {
  it("keeps the no-provider baseline explicitly unsupported at actual upgrade", async () => {
    server = await startTestServer();
    await expect(
      rejectedWebSocketStatus(websocketUrl(server.baseUrl)),
    ).resolves.toBe(501);
  });
});
