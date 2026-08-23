import { describe, expect, it } from "vitest";
import { p6rPrincipalKeySchema } from "@bb/domain";
import type { P6rPresenceViewer } from "@bb/server-contract";
import { P6rPresenceStore } from "./presence-store";

function viewer(
  p6rHandle: string,
  p6rTyping = false,
  p6rPrincipalKey?: P6rPresenceViewer["p6rPrincipalKey"],
): P6rPresenceViewer {
  return {
    ...(p6rPrincipalKey === undefined ? {} : { p6rPrincipalKey }),
    p6rHandle,
    p6rDisplayName: p6rHandle,
    p6rImageUrl: null,
    p6rTyping,
  };
}

describe("P6rPresenceStore", () => {
  it("replaces a thread roster and removes it when the roster empties", () => {
    const store = new P6rPresenceStore();
    store.p6rSetThreadViewers("thr_1", [viewer("alice"), viewer("bob")]);
    expect(store.p6rGetThreadViewers("thr_1").map((v) => v.p6rHandle)).toEqual([
      "alice",
      "bob",
    ]);

    store.p6rSetThreadViewers("thr_1", [viewer("alice")]);
    expect(store.p6rGetThreadViewers("thr_1").map((v) => v.p6rHandle)).toEqual([
      "alice",
    ]);

    store.p6rSetThreadViewers("thr_1", []);
    expect(store.p6rGetThreadViewers("thr_1")).toEqual([]);
  });

  it("patches the summary partially: merge entries, empty array removes", () => {
    const store = new P6rPresenceStore();
    store.p6rPatchSummary({ thr_1: ["alice"], thr_2: ["bob"] });
    // A later partial patch must not disturb untouched threads.
    store.p6rPatchSummary({ thr_2: ["bob", "carol"] });
    expect(store.p6rGetSummaryHandles("thr_1")).toEqual(["alice"]);
    expect(store.p6rGetSummaryHandles("thr_2")).toEqual(["bob", "carol"]);

    store.p6rPatchSummary({ thr_1: [] });
    expect(store.p6rGetSummaryHandles("thr_1")).toEqual([]);
    expect(store.p6rGetSummaryHandles("thr_2")).toEqual(["bob", "carol"]);
  });

  it("keeps equal-presentation summary viewers distinct by PrincipalKey", () => {
    const store = new P6rPresenceStore();
    store.p6rPatchSummary(
      { thr_1: ["sawyer", "sawyer"] },
      {
        thr_1: [
          viewer(
            "sawyer",
            false,
            p6rPrincipalKeySchema.parse("github:acct-42"),
          ),
          viewer(
            "sawyer",
            false,
            p6rPrincipalKeySchema.parse("google:acct-42"),
          ),
        ],
      },
    );

    expect(
      store.p6rGetSummaryViewers("thr_1").map((entry) => entry.p6rPrincipalKey),
    ).toEqual(["github:acct-42", "google:acct-42"]);
  });

  it("snapshot replace flushes rosters that went stale while disconnected", () => {
    const store = new P6rPresenceStore();
    store.p6rSetThreadViewers("thr_stale", [viewer("alice")]);
    store.p6rPatchSummary({ thr_stale: ["alice"] });

    const generation = store.p6rBeginSnapshot();
    store.p6rApplySnapshot({ thr_live: [viewer("bob", true)] }, generation);

    expect(store.p6rGetThreadViewers("thr_stale")).toEqual([]);
    expect(store.p6rGetSummaryHandles("thr_stale")).toEqual([]);
    expect(
      store.p6rGetThreadViewers("thr_live").map((v) => v.p6rHandle),
    ).toEqual(["bob"]);
    // Summary handles derive from the snapshot's viewer rosters.
    expect(store.p6rGetSummaryHandles("thr_live")).toEqual(["bob"]);
  });

  it("does not let an in-flight snapshot clobber a newer realtime update", () => {
    const store = new P6rPresenceStore();
    const generation = store.p6rBeginSnapshot();
    // Arrives while the snapshot request is still in flight.
    store.p6rSetThreadViewers("thr_1", [viewer("carol", true)]);
    store.p6rPatchSummary({ thr_1: ["carol"] });

    // The (older) snapshot resolves afterward with stale data for thr_1.
    store.p6rApplySnapshot(
      { thr_1: [viewer("alice")], thr_2: [viewer("bob")] },
      generation,
    );

    expect(store.p6rGetThreadViewers("thr_1").map((v) => v.p6rHandle)).toEqual([
      "carol",
    ]);
    expect(store.p6rGetSummaryHandles("thr_1")).toEqual(["carol"]);
    // Untouched threads still seed from the snapshot.
    expect(store.p6rGetThreadViewers("thr_2").map((v) => v.p6rHandle)).toEqual([
      "bob",
    ]);
    expect(store.p6rGetSummaryHandles("thr_2")).toEqual(["bob"]);
  });

  it("does not let an in-flight snapshot resurrect a realtime removal", () => {
    const store = new P6rPresenceStore();
    store.p6rSetThreadViewers("thr_1", [viewer("alice")]);
    store.p6rPatchSummary({ thr_1: ["alice"] });

    const generation = store.p6rBeginSnapshot();
    // The viewer leaves while the snapshot request is still in flight.
    store.p6rSetThreadViewers("thr_1", []);
    store.p6rPatchSummary({ thr_1: [] });

    // The (older) snapshot still lists the departed viewer.
    store.p6rApplySnapshot({ thr_1: [viewer("alice")] }, generation);

    expect(store.p6rGetThreadViewers("thr_1")).toEqual([]);
    expect(store.p6rGetSummaryHandles("thr_1")).toEqual([]);
  });

  it("guards viewer rosters and summaries independently", () => {
    const store = new P6rPresenceStore();
    const generation = store.p6rBeginSnapshot();
    // Only the summary is touched while the snapshot is in flight.
    store.p6rPatchSummary({ thr_1: ["carol"] });

    store.p6rApplySnapshot({ thr_1: [viewer("alice")] }, generation);

    // The untouched roster seeds from the snapshot; the touched summary wins.
    expect(store.p6rGetThreadViewers("thr_1").map((v) => v.p6rHandle)).toEqual([
      "alice",
    ]);
    expect(store.p6rGetSummaryHandles("thr_1")).toEqual(["carol"]);
  });

  it("drops an older snapshot that resolves after a newer one applied", () => {
    const store = new P6rPresenceStore();
    const captureA = store.p6rBeginSnapshot();
    const captureB = store.p6rBeginSnapshot();

    // B (the newer request) resolves first and seeds newer state, including
    // the removal of thr_gone; then A's stale response arrives.
    store.p6rApplySnapshot({ thr_1: [viewer("newer")] }, captureB);
    store.p6rApplySnapshot(
      { thr_1: [viewer("older")], thr_gone: [viewer("ghost")] },
      captureA,
    );

    expect(store.p6rGetThreadViewers("thr_1").map((v) => v.p6rHandle)).toEqual([
      "newer",
    ]);
    expect(store.p6rGetThreadViewers("thr_gone")).toEqual([]);
    expect(store.p6rGetSummaryHandles("thr_1")).toEqual(["newer"]);
    expect(store.p6rGetSummaryHandles("thr_gone")).toEqual([]);
  });

  it("returns a stable reference for an unchanged roster", () => {
    const store = new P6rPresenceStore();
    store.p6rSetThreadViewers("thr_1", [viewer("alice")]);
    const first = store.p6rGetThreadViewers("thr_1");
    store.p6rSetThreadViewers("thr_2", [viewer("bob")]);
    expect(store.p6rGetThreadViewers("thr_1")).toBe(first);
  });
});
