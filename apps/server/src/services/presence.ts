import type {
  P6rClaimedIdentity,
  P6rPresenceViewer,
  P6rPrincipalKey,
} from "@bb/domain";
import { p6rGetSocketActor } from "../ws/socket-actors.js";

export const P6R_PRESENCE_TYPING_TTL_MS = 6_000;

interface P6rViewerState {
  actorsBySocket: Map<object, P6rClaimedIdentity>;
  typingTimeoutsBySocket: Map<object, ReturnType<typeof setTimeout>>;
}

interface P6rPresenceServiceArgs {
  p6rOnThreadChanged(
    threadId: string,
    p6rViewers: readonly P6rPresenceViewer[],
  ): void;
  p6rTypingTtlMs?: number;
}

export interface P6rPresenceSnapshot {
  p6rThreads: Record<string, readonly P6rPresenceViewer[]>;
}

export interface P6rPresenceSnapshotOptions {
  suppressPrincipalKey?: P6rPrincipalKey;
}

export type P6rPresenceSubscriptionResult = "changed" | "ignored" | "unchanged";

/**
 * Ephemeral presence derived from thread-detail subscriptions. The service
 * retains one entry per PrincipalKey and reference-counts that principal's
 * sockets. Legacy identities remain in a client-scoped arm and never fall
 * back to presentation-field equality.
 */
export class P6rPresenceService {
  private readonly groupsByThreadBySocket = new WeakMap<
    object,
    Map<string, string>
  >();
  private readonly lastEmittedRosterByThread = new Map<string, string>();
  private readonly p6rOnThreadChanged: P6rPresenceServiceArgs["p6rOnThreadChanged"];
  private readonly typingTtlMs: number;
  private readonly viewersByThread = new Map<
    string,
    Map<string, P6rViewerState>
  >();

  constructor(args: P6rPresenceServiceArgs) {
    this.p6rOnThreadChanged = args.p6rOnThreadChanged;
    this.typingTtlMs = args.p6rTypingTtlMs ?? P6R_PRESENCE_TYPING_TTL_MS;
  }

  p6rSubscribe(
    threadId: string,
    socket: object,
  ): P6rPresenceSubscriptionResult {
    const actor = p6rGetSocketActor(socket);
    if (actor === null) {
      return "ignored";
    }

    const groupsByThread =
      this.groupsByThreadBySocket.get(socket) ?? new Map<string, string>();
    if (groupsByThread.has(threadId)) {
      return "ignored";
    }
    const groupKey = p6rPresenceGroupKey(actor);
    groupsByThread.set(threadId, groupKey);
    this.groupsByThreadBySocket.set(socket, groupsByThread);

    const p6rViewers =
      this.viewersByThread.get(threadId) ?? new Map<string, P6rViewerState>();
    const viewer = p6rViewers.get(groupKey) ?? {
      actorsBySocket: new Map<object, P6rClaimedIdentity>(),
      typingTimeoutsBySocket: new Map<object, ReturnType<typeof setTimeout>>(),
    };
    viewer.actorsBySocket.set(socket, actor);
    p6rViewers.set(groupKey, viewer);
    this.viewersByThread.set(threadId, p6rViewers);
    return this.emitIfChanged(threadId) ? "changed" : "unchanged";
  }

  p6rUnsubscribe(threadId: string, socket: object): void {
    const groupsByThread = this.groupsByThreadBySocket.get(socket);
    if (groupsByThread === undefined) {
      return;
    }
    const groupKey = groupsByThread.get(threadId);
    if (groupKey === undefined) {
      return;
    }
    groupsByThread.delete(threadId);
    if (groupsByThread.size === 0) {
      this.groupsByThreadBySocket.delete(socket);
    }

    const p6rViewers = this.viewersByThread.get(threadId);
    const viewer = p6rViewers?.get(groupKey);
    if (viewer === undefined || p6rViewers === undefined) {
      return;
    }
    this.clearSocketTyping(viewer, socket);
    viewer.actorsBySocket.delete(socket);
    if (viewer.actorsBySocket.size === 0) {
      p6rViewers.delete(groupKey);
    }
    if (p6rViewers.size === 0) {
      this.viewersByThread.delete(threadId);
    }
    this.emitIfChanged(threadId);
  }

  p6rSetTyping(socket: object, threadId: string, p6rTyping: boolean): void {
    const groupKey = this.groupsByThreadBySocket.get(socket)?.get(threadId);
    if (groupKey === undefined) {
      return;
    }
    const viewer = this.viewersByThread.get(threadId)?.get(groupKey);
    if (viewer === undefined) {
      return;
    }

    const wasTyping = viewer.typingTimeoutsBySocket.size > 0;
    this.clearSocketTyping(viewer, socket);
    if (!p6rTyping) {
      if (wasTyping && viewer.typingTimeoutsBySocket.size === 0) {
        this.emitIfChanged(threadId);
      }
      return;
    }

    const typingTimeout = setTimeout(() => {
      if (viewer.typingTimeoutsBySocket.get(socket) !== typingTimeout) {
        return;
      }
      viewer.typingTimeoutsBySocket.delete(socket);
      if (viewer.typingTimeoutsBySocket.size === 0) {
        this.emitIfChanged(threadId);
      }
    }, this.typingTtlMs);
    typingTimeout.unref();
    viewer.typingTimeoutsBySocket.set(socket, typingTimeout);

    if (!wasTyping) {
      this.emitIfChanged(threadId);
    }
  }

  p6rSnapshot(
    options: P6rPresenceSnapshotOptions = {},
  ): P6rPresenceSnapshot {
    const threads: Record<string, readonly P6rPresenceViewer[]> = {};
    for (const threadId of [...this.viewersByThread.keys()].sort()) {
      const p6rViewers = this.rosterForThread(
        threadId,
        options.suppressPrincipalKey,
      );
      if (p6rViewers.length > 0) {
        threads[threadId] = p6rViewers;
      }
    }
    return { p6rThreads: threads };
  }

  private clearSocketTyping(viewer: P6rViewerState, socket: object): void {
    const typingTimeout = viewer.typingTimeoutsBySocket.get(socket);
    if (typingTimeout === undefined) {
      return;
    }
    clearTimeout(typingTimeout);
    viewer.typingTimeoutsBySocket.delete(socket);
  }

  private emitIfChanged(threadId: string): boolean {
    const roster = this.rosterForThread(threadId);
    const serialized = JSON.stringify(roster);
    if (this.lastEmittedRosterByThread.get(threadId) === serialized) {
      return false;
    }
    this.lastEmittedRosterByThread.set(threadId, serialized);
    this.p6rOnThreadChanged(threadId, roster);
    return true;
  }

  private rosterForThread(
    threadId: string,
    suppressPrincipalKey?: P6rPrincipalKey,
  ): readonly P6rPresenceViewer[] {
    const p6rViewers = this.viewersByThread.get(threadId);
    if (p6rViewers === undefined) {
      return [];
    }
    return [...p6rViewers.values()]
      .map((viewer) => {
        const actor = this.firstActor(viewer);
        return {
          ...(actor.p6rPrincipalKey === undefined
            ? {}
            : { p6rPrincipalKey: actor.p6rPrincipalKey }),
          p6rHandle: actor.p6rHandle,
          p6rDisplayName: actor.p6rDisplayName,
          p6rImageUrl: actor.p6rImageUrl,
          p6rTyping: viewer.typingTimeoutsBySocket.size > 0,
        };
      })
      .filter(
        (viewer) =>
          suppressPrincipalKey === undefined ||
          viewer.p6rPrincipalKey !== suppressPrincipalKey,
      );
  }

  private firstActor(viewer: P6rViewerState): P6rClaimedIdentity {
    for (const actor of viewer.actorsBySocket.values()) {
      return actor;
    }
    throw new Error("Presence viewer has no subscribed sockets");
  }
}

function p6rPresenceGroupKey(actor: P6rClaimedIdentity): string {
  return actor.p6rPrincipalKey === undefined
    ? `legacy-client:${actor.p6rClientId}`
    : `principal:${actor.p6rPrincipalKey}`;
}
