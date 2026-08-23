import { describe, expect, it, vi } from "vitest";
import { WebSocketManager } from "./ws";

describe("WebSocketManager presence routing", () => {
  it("dispatches thread-presence rosters with lenient per-viewer defaults", () => {
    const manager = new WebSocketManager();
    const received = vi.fn();
    manager.p6rOnThreadPresence(received);

    manager.handleIncomingMessage(
      JSON.stringify({
        type: "p6r-thread-presence",
        p6rThreadId: "thr_1",
        p6rViewers: [
          {
            p6rHandle: "alice",
            p6rDisplayName: "Alice",
            p6rImageUrl: null,
            p6rTyping: true,
            // Additive field from a newer server must not drop the roster.
            futureField: "ignored",
          },
        ],
      }),
    );

    expect(received).toHaveBeenCalledTimes(1);
    expect(received.mock.calls[0]?.[0]).toEqual({
      type: "p6r-thread-presence",
      p6rThreadId: "thr_1",
      p6rViewers: [
        {
          p6rHandle: "alice",
          p6rDisplayName: "Alice",
          p6rImageUrl: null,
          p6rTyping: true,
        },
      ],
    });
  });

  it("dispatches presence-summary patches including empty-array removals", () => {
    const manager = new WebSocketManager();
    const received = vi.fn();
    manager.p6rOnPresenceSummary(received);

    manager.handleIncomingMessage(
      JSON.stringify({
        type: "p6r-presence-summary",
        p6rThreads: { thr_1: ["alice"], thr_2: [] },
      }),
    );

    expect(received).toHaveBeenCalledWith({
      type: "p6r-presence-summary",
      p6rThreads: { thr_1: ["alice"], thr_2: [] },
    });
  });

  it("preserves provider-distinct viewer profiles for the sidebar summary", () => {
    const manager = new WebSocketManager();
    const received = vi.fn();
    manager.p6rOnPresenceSummary(received);

    manager.handleIncomingMessage(
      JSON.stringify({
        type: "p6r-presence-summary",
        p6rThreads: { thr_1: ["sawyer", "sawyer"] },
        p6rThreadViewers: {
          thr_1: [
            {
              p6rPrincipalKey: "github:acct-42",
              p6rHandle: "sawyer",
              p6rDisplayName: "Sawyer Chen",
              p6rImageUrl: null,
              p6rTyping: false,
            },
            {
              p6rPrincipalKey: "google:acct-42",
              p6rHandle: "sawyer",
              p6rDisplayName: "Sawyer Chen",
              p6rImageUrl: null,
              p6rTyping: false,
            },
          ],
        },
      }),
    );

    expect(received).toHaveBeenCalledWith(
      expect.objectContaining({
        p6rThreadViewers: {
          thr_1: [
            expect.objectContaining({ p6rPrincipalKey: "github:acct-42" }),
            expect.objectContaining({ p6rPrincipalKey: "google:acct-42" }),
          ],
        },
      }),
    );
  });

  it("does not misroute presence messages to changed-message subscribers", () => {
    const manager = new WebSocketManager();
    const changed = vi.fn();
    manager.onChanged(changed);

    manager.handleIncomingMessage(
      JSON.stringify({
        type: "p6r-thread-presence",
        p6rThreadId: "thr_1",
        p6rViewers: [],
      }),
    );

    expect(changed).not.toHaveBeenCalled();
  });
});
