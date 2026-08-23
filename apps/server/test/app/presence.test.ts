import {
  p6rPresenceSummaryMessageSchema,
  p6rThreadPresenceMessageSchema,
} from "@bb/server-contract";
import { p6rClaimedIdentitySchema, p6rPrincipalKeySchema } from "@bb/domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  onClientSocketClose,
  onClientSocketMessage,
  onClientSocketOpen,
} from "../../src/ws/client-protocol.js";
import { NotificationHub } from "../../src/ws/hub.js";
import {
  p6rRegisterSocketActor,
  p6rReleaseSocketActor,
} from "../../src/ws/socket-actors.js";
import { createMockHubSocket } from "../helpers/mock-hub-socket.js";

const sawyer = {
  p6rHandle: "sawyer",
  p6rDisplayName: "Sawyer",
  p6rImageUrl: null,
  p6rClientId: "browser-1",
} as const;

const sawyerPrincipal = {
  ...sawyer,
  p6rPrincipalKey: p6rPrincipalKeySchema.parse("local:sawyer"),
};

function messages(socket: ReturnType<typeof createMockHubSocket>) {
  return socket.messages.map((message) => JSON.parse(message) as unknown);
}

function protocolDeps(hub: NotificationHub) {
  return {
    hub,
    watchInterests: {
      releaseSocket: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("thread presence", () => {
  it("broadcasts strict detail and partial-summary payloads on subscribe and unsubscribe", () => {
    const hub = new NotificationHub();
    const detailSocket = createMockHubSocket();
    const listSocket = createMockHubSocket();
    p6rRegisterSocketActor(detailSocket, sawyer);
    hub.subscribe(listSocket, { kind: "thread-list" });

    hub.subscribe(detailSocket, {
      kind: "thread-detail",
      threadId: "thread-1",
    });

    const detail = p6rThreadPresenceMessageSchema.parse(
      messages(detailSocket)[0],
    );
    const summary = p6rPresenceSummaryMessageSchema.parse(
      messages(listSocket)[0],
    );
    expect(detail).toEqual({
      type: "p6r-thread-presence",
      p6rThreadId: "thread-1",
      p6rViewers: [
        {
          p6rHandle: "sawyer",
          p6rDisplayName: "Sawyer",
          p6rImageUrl: null,
          p6rTyping: false,
        },
      ],
    });
    expect(summary).toEqual({
      type: "p6r-presence-summary",
      p6rThreads: { "thread-1": ["sawyer"] },
      p6rThreadViewers: { "thread-1": detail.p6rViewers },
    });
    expect(hub.p6rGetPresenceSnapshot()).toEqual({
      p6rThreads: { "thread-1": detail.p6rViewers },
    });

    hub.unsubscribe(detailSocket, {
      kind: "thread-detail",
      threadId: "thread-1",
    });

    expect(
      p6rPresenceSummaryMessageSchema.parse(messages(listSocket)[1]),
    ).toEqual({
      type: "p6r-presence-summary",
      p6rThreads: { "thread-1": [] },
      p6rThreadViewers: { "thread-1": [] },
    });
    expect(hub.p6rGetPresenceSnapshot()).toEqual({ p6rThreads: {} });
    p6rReleaseSocketActor(detailSocket);
  });

  it("skips presence broadcasts that fail the strict outgoing schemas", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    try {
      const hub = new NotificationHub();
      const socket = createMockHubSocket();
      p6rRegisterSocketActor(socket, {
        ...sawyer,
        p6rDisplayName: "",
      });

      hub.subscribe(socket, {
        kind: "thread-detail",
        threadId: "thread-1",
      });

      expect(socket.messages).toHaveLength(0);
      expect(consoleError).toHaveBeenCalledWith(
        "Skipping invalid realtime presence broadcast",
        expect.anything(),
      );
      hub.unregisterClient(socket);
      p6rReleaseSocketActor(socket);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("dedupes a PrincipalKey across sockets and removes it only after the last socket closes", () => {
    const hub = new NotificationHub();
    const firstSocket = createMockHubSocket();
    const secondSocket = createMockHubSocket();
    const listSocket = createMockHubSocket();
    p6rRegisterSocketActor(firstSocket, sawyerPrincipal);
    p6rRegisterSocketActor(secondSocket, {
      ...sawyerPrincipal,
      p6rClientId: "browser-2",
    });
    hub.subscribe(listSocket, { kind: "thread-list" });
    hub.subscribe(firstSocket, {
      kind: "thread-detail",
      threadId: "thread-1",
    });
    firstSocket.messages.length = 0;
    listSocket.messages.length = 0;

    hub.subscribe(secondSocket, {
      kind: "thread-detail",
      threadId: "thread-1",
    });

    expect(messages(secondSocket)).toEqual([
      {
        type: "p6r-thread-presence",
        p6rThreadId: "thread-1",
        p6rViewers: [],
      },
    ]);
    expect(firstSocket.messages).toHaveLength(0);
    expect(listSocket.messages).toHaveLength(0);

    hub.unregisterClient(firstSocket);
    expect(listSocket.messages).toHaveLength(0);
    expect(hub.p6rGetPresenceSnapshot().p6rThreads["thread-1"]).toHaveLength(1);

    hub.unregisterClient(secondSocket);
    expect(messages(listSocket)).toEqual([
      {
        type: "p6r-presence-summary",
        p6rThreads: { "thread-1": [] },
        p6rThreadViewers: { "thread-1": [] },
      },
    ]);
    expect(hub.p6rGetPresenceSnapshot()).toEqual({ p6rThreads: {} });
    p6rReleaseSocketActor(firstSocket);
    p6rReleaseSocketActor(secondSocket);
  });

  it("preserves provider-distinct principals and suppresses only the exact viewer", () => {
    const hub = new NotificationHub();
    const githubSocket = createMockHubSocket();
    const githubSecondSocket = createMockHubSocket();
    const googleSocket = createMockHubSocket();
    const githubActor = p6rClaimedIdentitySchema.parse({
      ...sawyer,
      p6rClientId: "github-browser",
      p6rPrincipalKey: "github:acct-42",
    });
    const githubSecondActor = p6rClaimedIdentitySchema.parse({
      ...githubActor,
      p6rClientId: "github-second-browser",
      p6rDisplayName: "Later Sawyer",
    });
    const googleActor = p6rClaimedIdentitySchema.parse({
      ...sawyer,
      p6rClientId: "google-browser",
      p6rPrincipalKey: "google:acct-42",
    });

    p6rRegisterSocketActor(githubSocket, githubActor);
    p6rRegisterSocketActor(githubSecondSocket, githubSecondActor);
    p6rRegisterSocketActor(googleSocket, googleActor);

    hub.subscribe(githubSocket, {
      kind: "thread-detail",
      threadId: "thread-1",
    });
    hub.subscribe(githubSecondSocket, {
      kind: "thread-detail",
      threadId: "thread-1",
    });
    hub.subscribe(googleSocket, {
      kind: "thread-detail",
      threadId: "thread-1",
    });

    const expectedViewers = [
      {
        p6rPrincipalKey: "github:acct-42",
        p6rHandle: "sawyer",
        p6rDisplayName: "Sawyer",
        p6rImageUrl: null,
        p6rTyping: false,
      },
      {
        p6rPrincipalKey: "google:acct-42",
        p6rHandle: "sawyer",
        p6rDisplayName: "Sawyer",
        p6rImageUrl: null,
        p6rTyping: false,
      },
    ];
    expect(hub.p6rGetPresenceSnapshot()).toEqual({
      p6rThreads: { "thread-1": expectedViewers },
    });
    expect(
      hub.p6rGetPresenceSnapshot({
        suppressPrincipalKey: githubActor.p6rPrincipalKey,
      }),
    ).toEqual({
      p6rThreads: { "thread-1": [expectedViewers[1]] },
    });
    expect(
      p6rThreadPresenceMessageSchema.parse(
        messages(githubSocket)[messages(githubSocket).length - 1],
      ).p6rViewers,
    ).toEqual([expectedViewers[1]]);
    expect(
      p6rThreadPresenceMessageSchema.parse(
        messages(googleSocket)[messages(googleSocket).length - 1],
      ).p6rViewers,
    ).toEqual([expectedViewers[0]]);

    hub.unregisterClient(githubSocket);
    hub.unregisterClient(githubSecondSocket);
    hub.unregisterClient(googleSocket);
    p6rReleaseSocketActor(githubSocket);
    p6rReleaseSocketActor(githubSecondSocket);
    p6rReleaseSocketActor(googleSocket);
  });

  it("expires p6rTyping after the TTL and suppresses unchanged rebroadcasts", async () => {
    vi.useFakeTimers();
    const hub = new NotificationHub({ p6rPresenceTypingTtlMs: 50 });
    const detailSocket = createMockHubSocket();
    const listSocket = createMockHubSocket();
    p6rRegisterSocketActor(detailSocket, sawyer);
    hub.subscribe(listSocket, { kind: "thread-list" });
    hub.subscribe(detailSocket, {
      kind: "thread-detail",
      threadId: "thread-1",
    });
    detailSocket.messages.length = 0;
    listSocket.messages.length = 0;

    hub.subscribe(detailSocket, {
      kind: "thread-detail",
      threadId: "thread-1",
    });
    expect(detailSocket.messages).toHaveLength(0);

    hub.p6rSetTyping(detailSocket, "thread-1", true);
    expect(
      p6rThreadPresenceMessageSchema.parse(messages(detailSocket)[0])
        .p6rViewers[0]?.p6rTyping,
    ).toBe(true);
    expect(listSocket.messages).toHaveLength(1);

    hub.p6rSetTyping(detailSocket, "thread-1", true);
    expect(detailSocket.messages).toHaveLength(1);
    expect(listSocket.messages).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(50);
    expect(
      p6rThreadPresenceMessageSchema.parse(messages(detailSocket)[1])
        .p6rViewers[0]?.p6rTyping,
    ).toBe(false);
    expect(listSocket.messages).toHaveLength(2);
    p6rReleaseSocketActor(detailSocket);
  });

  it("keeps a PrincipalKey p6rTyping while another socket remains explicitly active", () => {
    const hub = new NotificationHub();
    const firstSocket = createMockHubSocket();
    const secondSocket = createMockHubSocket();
    p6rRegisterSocketActor(firstSocket, sawyerPrincipal);
    p6rRegisterSocketActor(secondSocket, {
      ...sawyerPrincipal,
      p6rClientId: "browser-2",
    });
    hub.subscribe(firstSocket, {
      kind: "thread-detail",
      threadId: "thread-1",
    });
    hub.subscribe(secondSocket, {
      kind: "thread-detail",
      threadId: "thread-1",
    });

    hub.p6rSetTyping(firstSocket, "thread-1", true);
    hub.p6rSetTyping(secondSocket, "thread-1", true);
    hub.p6rSetTyping(firstSocket, "thread-1", false);
    expect(
      hub.p6rGetPresenceSnapshot().p6rThreads["thread-1"]?.[0]?.p6rTyping,
    ).toBe(true);

    hub.p6rSetTyping(secondSocket, "thread-1", false);
    expect(
      hub.p6rGetPresenceSnapshot().p6rThreads["thread-1"]?.[0]?.p6rTyping,
    ).toBe(false);
    hub.unregisterClient(firstSocket);
    hub.unregisterClient(secondSocket);
    p6rReleaseSocketActor(firstSocket);
    p6rReleaseSocketActor(secondSocket);
  });

  it("keeps a PrincipalKey p6rTyping when one socket TTL expires before another", async () => {
    vi.useFakeTimers();
    const hub = new NotificationHub({ p6rPresenceTypingTtlMs: 50 });
    const firstSocket = createMockHubSocket();
    const secondSocket = createMockHubSocket();
    p6rRegisterSocketActor(firstSocket, sawyerPrincipal);
    p6rRegisterSocketActor(secondSocket, {
      ...sawyerPrincipal,
      p6rClientId: "browser-2",
    });
    hub.subscribe(firstSocket, {
      kind: "thread-detail",
      threadId: "thread-1",
    });
    hub.subscribe(secondSocket, {
      kind: "thread-detail",
      threadId: "thread-1",
    });

    hub.p6rSetTyping(firstSocket, "thread-1", true);
    await vi.advanceTimersByTimeAsync(25);
    hub.p6rSetTyping(secondSocket, "thread-1", true);
    await vi.advanceTimersByTimeAsync(25);
    expect(
      hub.p6rGetPresenceSnapshot().p6rThreads["thread-1"]?.[0]?.p6rTyping,
    ).toBe(true);

    await vi.advanceTimersByTimeAsync(25);
    expect(
      hub.p6rGetPresenceSnapshot().p6rThreads["thread-1"]?.[0]?.p6rTyping,
    ).toBe(false);
    hub.unregisterClient(firstSocket);
    hub.unregisterClient(secondSocket);
    p6rReleaseSocketActor(firstSocket);
    p6rReleaseSocketActor(secondSocket);
  });

  it("folds p6rTyping protocol messages into presence and removes presence before releasing the actor", () => {
    const hub = new NotificationHub();
    const deps = protocolDeps(hub);
    const socket = createMockHubSocket();
    p6rRegisterSocketActor(socket, sawyer);
    onClientSocketOpen(hub, socket);
    onClientSocketMessage(
      deps,
      socket,
      JSON.stringify({
        type: "subscribe",
        target: { kind: "thread-detail", threadId: "thread-1" },
      }),
    );
    socket.messages.length = 0;

    onClientSocketMessage(
      deps,
      socket,
      JSON.stringify({
        type: "p6r-typing",
        p6rThreadId: "thread-1",
        p6rTyping: true,
      }),
    );

    expect(
      p6rThreadPresenceMessageSchema.parse(messages(socket)[0]).p6rViewers[0]
        ?.p6rTyping,
    ).toBe(true);
    onClientSocketClose(deps, socket);
    expect(hub.p6rGetPresenceSnapshot()).toEqual({ p6rThreads: {} });
  });
});
