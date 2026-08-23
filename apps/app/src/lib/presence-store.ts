import { useSyncExternalStore } from "react";
import type { P6rPresenceViewer } from "@bb/server-contract";
import { apiClient } from "./api-server";
import { request } from "./api";
import type { P6rPresenceSnapshotResponse } from "@bb/server-contract";
import { wsManager, type WebSocketManager } from "./ws";

/**
 * Client-side presence read model, fed by the realtime socket:
 * - `p6r-thread-presence` replaces one thread's full viewer roster (empty removes)
 * - `p6r-presence-summary` is a partial patch of threadId -> viewer profiles
 *   for the sidebar; legacy handle arrays remain readable
 * - the GET /api/v1/presence snapshot re-seeds everything on (re)connect,
 *   flushing rosters that went stale while the socket was down.
 *
 * All state is ephemeral — nothing persists across reloads.
 */

const P6R_EMPTY_VIEWERS: readonly P6rPresenceViewer[] = [];
const P6R_EMPTY_HANDLES: readonly string[] = [];

/** Handle returned by beginSnapshot; identifies one snapshot request. */
export interface P6rSnapshotCapture {
  snapshotId: number;
  sinceGeneration: number;
}

export class P6rPresenceStore {
  private viewersByThreadId = new Map<string, readonly P6rPresenceViewer[]>();
  private summaryViewersByThreadId = new Map<
    string,
    readonly P6rPresenceViewer[]
  >();
  private listeners = new Set<() => void>();
  // Ordering guard for the async snapshot: every applied realtime message
  // bumps `generation` and stamps the thread ids it touched. The snapshot
  // captures the generation before its HTTP request and, when it resolves,
  // skips any thread a newer realtime message already updated or removed —
  // live broadcasts always beat the older snapshot.
  private generation = 0;
  private viewerTouchGeneration = new Map<string, number>();
  private summaryTouchGeneration = new Map<string, number>();
  // Snapshot requests are ordered too: only the most recently begun snapshot
  // may apply, so a slow response from an earlier (re)connect can never roll
  // back the state a later snapshot already seeded.
  private latestSnapshotId = 0;

  p6rAttach(manager: WebSocketManager): () => void {
    const unsubscribePresence = manager.p6rOnThreadPresence((message) => {
      this.p6rSetThreadViewers(message.p6rThreadId, message.p6rViewers);
    });
    const unsubscribeSummary = manager.p6rOnPresenceSummary((message) => {
      this.p6rPatchSummary(message.p6rThreads, message.p6rThreadViewers);
    });
    const unsubscribeConnected = manager.onConnected(() => {
      void this.seedFromSnapshot();
    });
    return () => {
      unsubscribePresence();
      unsubscribeSummary();
      unsubscribeConnected();
    };
  }

  private async seedFromSnapshot(): Promise<void> {
    const capture = this.p6rBeginSnapshot();
    let snapshot: P6rPresenceSnapshotResponse;
    try {
      snapshot = await request<P6rPresenceSnapshotResponse>(
        apiClient["p6r-presence"].$get(),
      );
    } catch {
      // Presence is cosmetic; a failed seed just waits for live broadcasts.
      return;
    }
    this.p6rApplySnapshot(snapshot.p6rThreads, capture);
  }

  /** Capture before requesting a snapshot; pass the result to applySnapshot. */
  p6rBeginSnapshot(): P6rSnapshotCapture {
    this.latestSnapshotId += 1;
    return {
      snapshotId: this.latestSnapshotId,
      sinceGeneration: this.generation,
    };
  }

  /**
   * Apply the HTTP snapshot (complete current rosters): flush entries absent
   * from it and replace the rest — except threads a realtime message touched
   * after the capture, whose newer live state (including removal) wins. A
   * snapshot that is no longer the most recently begun one is dropped whole:
   * a newer request supersedes it regardless of response arrival order.
   */
  p6rApplySnapshot(
    threads: Record<string, readonly P6rPresenceViewer[]>,
    capture: P6rSnapshotCapture,
  ): void {
    if (capture.snapshotId !== this.latestSnapshotId) {
      return;
    }
    const sinceGeneration = capture.sinceGeneration;
    const untouched = (touches: Map<string, number>, threadId: string) =>
      (touches.get(threadId) ?? 0) <= sinceGeneration;
    for (const threadId of [...this.viewersByThreadId.keys()]) {
      if (
        !(threadId in threads) &&
        untouched(this.viewerTouchGeneration, threadId)
      ) {
        this.viewersByThreadId.delete(threadId);
      }
    }
    for (const threadId of [...this.summaryViewersByThreadId.keys()]) {
      if (
        !(threadId in threads) &&
        untouched(this.summaryTouchGeneration, threadId)
      ) {
        this.summaryViewersByThreadId.delete(threadId);
      }
    }
    for (const [threadId, p6rViewers] of Object.entries(threads)) {
      if (untouched(this.viewerTouchGeneration, threadId)) {
        if (p6rViewers.length === 0) {
          this.viewersByThreadId.delete(threadId);
        } else {
          this.viewersByThreadId.set(threadId, p6rViewers);
        }
      }
      if (untouched(this.summaryTouchGeneration, threadId)) {
        if (p6rViewers.length === 0) {
          this.summaryViewersByThreadId.delete(threadId);
        } else {
          this.summaryViewersByThreadId.set(threadId, p6rViewers);
        }
      }
    }
    this.notify();
  }

  p6rSetThreadViewers(
    threadId: string,
    p6rViewers: readonly P6rPresenceViewer[],
  ): void {
    this.generation += 1;
    this.viewerTouchGeneration.set(threadId, this.generation);
    if (p6rViewers.length === 0) {
      this.viewersByThreadId.delete(threadId);
    } else {
      this.viewersByThreadId.set(threadId, p6rViewers);
    }
    this.notify();
  }

  p6rPatchSummary(
    threads: Record<string, readonly string[]>,
    viewerProfiles: Record<string, readonly P6rPresenceViewer[]> = {},
  ): void {
    this.generation += 1;
    for (const [threadId, handles] of Object.entries(threads)) {
      this.summaryTouchGeneration.set(threadId, this.generation);
      if (handles.length === 0) {
        this.summaryViewersByThreadId.delete(threadId);
      } else {
        this.summaryViewersByThreadId.set(
          threadId,
          viewerProfiles[threadId] ??
            handles.map((p6rHandle) => ({
              p6rHandle,
              p6rDisplayName: p6rHandle,
              p6rImageUrl: null,
              p6rTyping: false,
            })),
        );
      }
    }
    this.notify();
  }

  p6rGetThreadViewers(threadId: string): readonly P6rPresenceViewer[] {
    return this.viewersByThreadId.get(threadId) ?? P6R_EMPTY_VIEWERS;
  }

  p6rGetSummaryHandles(threadId: string): readonly string[] {
    return (
      this.summaryViewersByThreadId
        .get(threadId)
        ?.map((viewer) => viewer.p6rHandle) ?? P6R_EMPTY_HANDLES
    );
  }

  p6rGetSummaryViewers(threadId: string): readonly P6rPresenceViewer[] {
    return this.summaryViewersByThreadId.get(threadId) ?? P6R_EMPTY_VIEWERS;
  }

  p6rSubscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

// Singleton mirroring the wsManager pattern — preserved across Vite HMR so
// presence state and its socket listeners survive module re-evaluation.
function p6rCreateOrReusePresenceStore(): P6rPresenceStore {
  if (import.meta.hot?.data) {
    const existing = import.meta.hot.data.p6rPresenceStore as
      | P6rPresenceStore
      | undefined;
    if (existing) return existing;
    const instance = new P6rPresenceStore();
    instance.p6rAttach(wsManager);
    import.meta.hot.data.p6rPresenceStore = instance;
    return instance;
  }
  const instance = new P6rPresenceStore();
  instance.p6rAttach(wsManager);
  return instance;
}

export const p6rPresenceStore = p6rCreateOrReusePresenceStore();

/** Live viewer roster for one thread (stable reference until it changes). */
export function useP6rThreadPresenceViewers(
  threadId: string,
): readonly P6rPresenceViewer[] {
  return useSyncExternalStore(
    p6rPresenceStore.p6rSubscribe,
    () => p6rPresenceStore.p6rGetThreadViewers(threadId),
    () => P6R_EMPTY_VIEWERS,
  );
}

/** Sidebar-summary viewer handles for one thread. */
export function useP6rThreadPresenceSummaryHandles(
  threadId: string,
): readonly string[] {
  return useSyncExternalStore(
    p6rPresenceStore.p6rSubscribe,
    () => p6rPresenceStore.p6rGetSummaryHandles(threadId),
    () => P6R_EMPTY_HANDLES,
  );
}

/** Sidebar-summary viewer profiles, preserving server order and PrincipalKey. */
export function useP6rThreadPresenceSummaryViewers(
  threadId: string,
): readonly P6rPresenceViewer[] {
  return useSyncExternalStore(
    p6rPresenceStore.p6rSubscribe,
    () => p6rPresenceStore.p6rGetSummaryViewers(threadId),
    () => P6R_EMPTY_VIEWERS,
  );
}
