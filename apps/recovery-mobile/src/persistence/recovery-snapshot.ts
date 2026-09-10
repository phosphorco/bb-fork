import type { RecoverySnapshotResponse } from "@bb/server-contract";
import { RECOVERY_SNAPSHOT_CONTRACT_VERSION } from "@bb/server-contract";
import type { BrowserBbSdk } from "@bb/sdk/browser";
import type { ObservedRecord, ProfileIdentityContext } from "./contracts";
import { buildRecoveryServerProfileKey } from "./recovery-namespace";
import type { RecoveryRepository } from "./repository";

export const RECOVERY_SIDEBAR_RECORD_KEY = "sidebar-bootstrap:v1";
export const RECOVERY_SNAPSHOT_METADATA_RECORD_KEY = "recovery-snapshot:v1";
export const RECOVERY_SNAPSHOT_DEFAULT_SEGMENT_LIMIT = 20;

function assertMatchingCacheOwner(
  namespace: ProfileIdentityContext,
  snapshot: RecoverySnapshotResponse,
): void {
  const owner = snapshot.cacheOwner;
  const matches =
    namespace.ownerState === "resolved"
      ? owner.state === "resolved" &&
        owner.principalKey === namespace.principalKey
      : owner.state === "read-only" && namespace.principalKey === null;
  if (!matches) {
    throw new Error(
      "Recovery snapshot principal does not match the cache namespace",
    );
  }
}

/**
 * Persist one server bundle as a single SQLite commit. Retry-marked timelines
 * are excluded; their head may have changed while the server projected rows.
 */
export async function ingestRecoverySnapshot(
  repository: RecoveryRepository,
  namespace: ProfileIdentityContext,
  snapshot: RecoverySnapshotResponse,
): Promise<{
  consistency: RecoverySnapshotResponse["consistency"];
  persistedTimelineCount: number;
}> {
  if (namespace.source !== "live") {
    throw new Error("Recovery snapshot requires a live identity session");
  }
  assertMatchingCacheOwner(namespace, snapshot);
  await repository.ensureNamespace({
    namespaceId: namespace.namespaceId,
    serverProfileKey: buildRecoveryServerProfileKey(namespace),
    ownerKey: namespace.principalKey ?? "read-only",
    ownerState: namespace.ownerState,
  });

  const coherentTimelines = snapshot.timelines.filter(
    (timeline) => timeline.consistency === "coherent",
  );
  const records: ObservedRecord[] = [
    {
      namespaceId: namespace.namespaceId,
      recordKey: RECOVERY_SIDEBAR_RECORD_KEY,
      payload: snapshot.sidebar,
      revision: 0,
      updatedAt: snapshot.generatedAtMs,
    },
    {
      namespaceId: namespace.namespaceId,
      recordKey: RECOVERY_SNAPSHOT_METADATA_RECORD_KEY,
      payload: {
        consistency: snapshot.consistency,
        incompleteReasons: snapshot.incompleteReasons,
        unavailableThreads: snapshot.unavailableThreads,
      },
      revision: 0,
      updatedAt: snapshot.generatedAtMs,
    },
    ...coherentTimelines.map((observation) => ({
      namespaceId: namespace.namespaceId,
      recordKey: `thread-timeline-latest:v1:${observation.threadId}`,
      payload: observation.timeline,
      revision: observation.headSequence,
      updatedAt: snapshot.generatedAtMs,
    })),
  ];
  await repository.putObservedRecords(records);
  return {
    consistency: snapshot.consistency,
    persistedTimelineCount: coherentTimelines.length,
  };
}

/** Network-to-SQLite seam for a future foreground/idle refresh scheduler. */
export async function refreshRecoverySnapshot(args: {
  sdk: Pick<BrowserBbSdk, "recovery">;
  repository: RecoveryRepository;
  namespace: ProfileIdentityContext;
  threadIds: string[];
  signal?: AbortSignal;
}): Promise<{
  consistency: RecoverySnapshotResponse["consistency"];
  persistedTimelineCount: number;
}> {
  const snapshot = await args.sdk.recovery.snapshot({
    contractVersion: RECOVERY_SNAPSHOT_CONTRACT_VERSION,
    threadIds: args.threadIds,
    timelineSegmentLimit: RECOVERY_SNAPSHOT_DEFAULT_SEGMENT_LIMIT,
    signal: args.signal,
  });
  return ingestRecoverySnapshot(args.repository, args.namespace, snapshot);
}
