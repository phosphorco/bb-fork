import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Fake socket that records its URL argument and reconnect() calls so the
// tests can assert client identity never rides the upgrade URL.
const fakeSocketState = vi.hoisted(() => {
  type UrlProvider = () => string;

  class FakeReconnectingWebSocket {
    onclose: (() => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onopen: (() => void) | null = null;
    readyState = 1;
    readonly sentMessages: string[] = [];
    reconnectCalls = 0;
    private readonly urlProvider: UrlProvider;

    constructor(url: string | UrlProvider) {
      this.urlProvider = typeof url === "function" ? url : () => url;
      instances.push(this);
    }

    close(): void {
      this.readyState = 3;
      this.onclose?.();
    }

    open(): void {
      this.readyState = 1;
      this.onopen?.();
    }

    send(data: string): void {
      this.sentMessages.push(data);
    }

    reconnect(): void {
      this.reconnectCalls += 1;
      this.close();
      this.open();
    }

    nextUpgradeUrl(): string {
      return this.urlProvider();
    }
  }

  const instances: FakeReconnectingWebSocket[] = [];

  return { FakeReconnectingWebSocket, instances };
});

// Controllable claimed-identity fake: the real store suppresses identities on
// localhost (the test origin), so the manager's transport path needs a fake.
const identityState = vi.hoisted(() => {
  const state = {
    value: null as {
      p6rHandle: string;
      p6rDisplayName: string;
      p6rImageUrl: string | null;
      p6rClientId: string;
    } | null,
    listeners: new Set<() => void>(),
    set(
      next: {
        p6rHandle: string;
        p6rDisplayName: string;
        p6rImageUrl: string | null;
        p6rClientId: string;
      } | null,
    ): void {
      state.value = next;
      for (const listener of state.listeners) {
        listener();
      }
    },
  };
  return state;
});

vi.mock("partysocket/ws", () => ({
  default: fakeSocketState.FakeReconnectingWebSocket,
}));

vi.mock("./dev-websocket-url", () => ({
  buildDevWebSocketUrl: () => "ws://bb.test/ws",
}));

vi.mock("./claimed-identity-store", () => ({
  p6rGetClaimedIdentity: () => identityState.value,
  p6rSubscribeClaimedIdentity: (listener: () => void) => {
    identityState.listeners.add(listener);
    return () => {
      identityState.listeners.delete(listener);
    };
  },
}));

import { WebSocketManager } from "./ws";

function getOnlySocket() {
  const socket = fakeSocketState.instances[0];
  if (!socket) {
    throw new Error("Expected websocket to be created");
  }
  return socket;
}

describe("WebSocketManager claimed presentation transport", () => {
  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    fakeSocketState.instances.length = 0;
    identityState.value = null;
    identityState.listeners.clear();
    Object.defineProperty(globalThis, "WebSocket", {
      configurable: true,
      value: { OPEN: 1 },
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "WebSocket", {
      configurable: true,
      value: originalWebSocket,
    });
  });

  it("sends a claimed presentation over the socket, never the upgrade URL", () => {
    const manager = new WebSocketManager();
    manager.connect();
    const socket = getOnlySocket();
    socket.open();

    expect(socket.nextUpgradeUrl()).toBe("ws://bb.test/ws");

    identityState.set({
      p6rHandle: "alice",
      p6rDisplayName: "Alice",
      p6rImageUrl: null,
      p6rClientId: "alice-client",
    });

    expect(socket.reconnectCalls).toBe(0);
    expect(fakeSocketState.instances).toHaveLength(1);
    expect(socket.nextUpgradeUrl()).toBe("ws://bb.test/ws");
    expect(socket.sentMessages.map((message) => JSON.parse(message))).toEqual([
      {
        type: "p6r-claimed-identity",
        p6rClaimedIdentity: {
          p6rHandle: "alice",
          p6rDisplayName: "Alice",
          p6rImageUrl: null,
          p6rClientId: "alice-client",
        },
      },
    ]);
  });

  it("sends explicit identity edits and clear without rebinding", () => {
    const manager = new WebSocketManager();
    manager.connect();
    const socket = getOnlySocket();
    socket.open();

    identityState.set({
      p6rHandle: "alice",
      p6rDisplayName: "Alice",
      p6rImageUrl: null,
      p6rClientId: "alice-client",
    });
    identityState.set({
      p6rHandle: "alice-cooper",
      p6rDisplayName: "Alice Cooper",
      p6rImageUrl: null,
      p6rClientId: "alice-client",
    });
    expect(socket.reconnectCalls).toBe(0);
    expect(socket.nextUpgradeUrl()).toBe("ws://bb.test/ws");

    identityState.set(null);
    expect(socket.reconnectCalls).toBe(0);
    expect(socket.nextUpgradeUrl()).toBe("ws://bb.test/ws");
    expect(socket.sentMessages.map((message) => JSON.parse(message))).toEqual([
      {
        type: "p6r-claimed-identity",
        p6rClaimedIdentity: {
          p6rHandle: "alice",
          p6rDisplayName: "Alice",
          p6rImageUrl: null,
          p6rClientId: "alice-client",
        },
      },
      {
        type: "p6r-claimed-identity",
        p6rClaimedIdentity: {
          p6rHandle: "alice-cooper",
          p6rDisplayName: "Alice Cooper",
          p6rImageUrl: null,
          p6rClientId: "alice-client",
        },
      },
      { type: "p6r-claimed-identity", p6rClaimedIdentity: null },
    ]);
  });

  it("ignores store notifications that leave the identity unchanged", () => {
    const manager = new WebSocketManager();
    manager.connect();
    const socket = getOnlySocket();
    socket.open();

    identityState.set(null);
    identityState.set(null);

    expect(socket.reconnectCalls).toBe(0);
  });

  it("resubscribes active targets over a normal reconnect", () => {
    const manager = new WebSocketManager();
    manager.connect();
    const socket = getOnlySocket();
    socket.open();
    manager.subscribe({ kind: "project-list" });
    socket.sentMessages.length = 0;

    socket.reconnect();

    expect(
      socket.sentMessages.map((message) => JSON.parse(message) as unknown),
    ).toEqual([{ type: "subscribe", target: { kind: "project-list" } }]);
  });

  it("stops listening for identity changes after disconnect", () => {
    const manager = new WebSocketManager();
    manager.connect();
    const socket = getOnlySocket();
    socket.open();
    manager.disconnect();

    identityState.set({
      p6rHandle: "alice",
      p6rDisplayName: "Alice",
      p6rImageUrl: null,
      p6rClientId: "alice-client",
    });

    expect(socket.reconnectCalls).toBe(0);
  });
});
