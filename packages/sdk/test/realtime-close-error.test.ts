import { expect, it } from "vitest";
import { createBbRealtimeClient } from "../src/realtime-client.js";
import { createHttpTransport } from "../src/transport-http.js";
import type { BbRealtimeSocket } from "../src/transport.js";

it("does not recursively close a socket that emits an error while closing", async () => {
  let closes = 0;
  const socket: BbRealtimeSocket = {
    readyState: 1, onopen: null, onclose: null, onerror: null, onmessage: null,
    send() {},
    close() {
      closes += 1;
      socket.onerror?.();
      socket.readyState = 3;
      socket.onclose?.();
    },
  };
  const client = createBbRealtimeClient({ transport: createHttpTransport({
    baseUrl: "http://fixture", runtime: "node", websocket: () => socket,
  }) });
  const unsubscribe = client.subscribe({ event: "system:changed", callback() {} });
  await Promise.resolve();
  socket.onopen?.();
  expect(socket.onerror).not.toBeNull();
  socket.onerror?.();
  unsubscribe();
  expect(closes).toBe(1);
});
