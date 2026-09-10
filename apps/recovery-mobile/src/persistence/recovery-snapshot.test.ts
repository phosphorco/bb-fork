import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RecoverySnapshotResponse } from "@bb/server-contract";
import { afterEach, describe, expect, it } from "vitest";
import { sidebarBootstrap, timelineResponse } from "@/data/test/fixtures";
import type { ProfileIdentityContext } from "./contracts";
import { NodeRecoverySqlDatabase } from "./node-sqlite";
import {
  ingestRecoverySnapshot,
  refreshRecoverySnapshot,
  RECOVERY_SIDEBAR_RECORD_KEY,
  RECOVERY_SNAPSHOT_METADATA_RECORD_KEY,
} from "./recovery-snapshot";
import { RecoveryRepository } from "./repository";

const temporaryDirectories: string[] = [];

async function createRepository(): Promise<RecoveryRepository> {
  const directory = await mkdtemp(join(tmpdir(), "bb-recovery-snapshot-"));
  temporaryDirectories.push(directory);
  const repository = new RecoveryRepository(
    NodeRecoverySqlDatabase.open(join(directory, "recovery.db")),
  );
  await repository.initialize();
  return repository;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const namespace: ProfileIdentityContext = {
  profileId: "profile-a",
  serverUrl: "https://bb.example.test",
  namespaceId: '["profile-a","principal-a"]',
  principalKey: "principal-a",
  providerId: "tailnet",
  subject: "subject-a",
  ownerState: "resolved",
  source: "live",
  updatedAt: 100,
};

function snapshot(): RecoverySnapshotResponse {
  return {
    contractVersion: 1,
    generatedAtMs: 200,
    consistency: "partial",
    incompleteReasons: ["sidebar-revision-unavailable"],
    cacheOwner: {
      state: "resolved",
      principalKey: "principal-a",
      actor: {
        p6rProviderId: "tailnet",
        p6rSubject: "subject-a",
        p6rHandle: "ada",
        p6rDisplayName: "Ada",
        p6rImageUrl: null,
      },
    },
    sidebar: sidebarBootstrap(),
    timelines: [
      {
        threadId: "thread-coherent",
        consistency: "coherent",
        headSequence: 7,
        projectionCoverage: "complete",
        olderCursor: null,
        timeline: timelineResponse([], { maxSeq: 7 }),
      },
      {
        threadId: "thread-retry",
        consistency: "retry",
        headSequence: 8,
        projectionCoverage: "windowed",
        olderCursor: { anchorSeq: 4, anchorId: "row-4" },
        timeline: timelineResponse([], { maxSeq: 8 }),
      },
    ],
    unavailableThreads: [{ threadId: "gone", reason: "not-found" }],
  };
}

describe("recovery snapshot ingestion", () => {
  it("atomically persists shared metadata and only coherent timelines", async () => {
    const repository = await createRepository();
    await expect(
      ingestRecoverySnapshot(repository, namespace, snapshot()),
    ).resolves.toEqual({
      consistency: "partial",
      persistedTimelineCount: 1,
    });

    await expect(
      repository.getObservedRecord(
        namespace.namespaceId,
        RECOVERY_SIDEBAR_RECORD_KEY,
      ),
    ).resolves.toMatchObject({ updatedAt: 200 });
    await expect(
      repository.getObservedRecord(
        namespace.namespaceId,
        "thread-timeline-latest:v1:thread-coherent",
      ),
    ).resolves.toMatchObject({ revision: 7 });
    await expect(
      repository.getObservedRecord(
        namespace.namespaceId,
        "thread-timeline-latest:v1:thread-retry",
      ),
    ).resolves.toBeNull();
    await expect(
      repository.getObservedRecord(
        namespace.namespaceId,
        RECOVERY_SNAPSHOT_METADATA_RECORD_KEY,
      ),
    ).resolves.toMatchObject({
      payload: { unavailableThreads: [{ threadId: "gone" }] },
    });
    await repository.close();
  });

  it("fetches through the SDK with the bounded default before ingestion", async () => {
    const repository = await createRepository();
    const requestedThreadIds: string[][] = [];
    await expect(
      refreshRecoverySnapshot({
        sdk: {
          recovery: {
            snapshot: async (input) => {
              requestedThreadIds.push(input.threadIds);
              expect(input).toMatchObject({
                contractVersion: 1,
                timelineSegmentLimit: 20,
              });
              return snapshot();
            },
          },
        },
        repository,
        namespace,
        threadIds: ["thread-coherent"],
      }),
    ).resolves.toEqual({
      consistency: "partial",
      persistedTimelineCount: 1,
    });
    expect(requestedThreadIds).toEqual([["thread-coherent"]]);
    await repository.close();
  });

  it("rejects another principal before creating or writing its namespace", async () => {
    const repository = await createRepository();
    const mismatched = snapshot();
    if (mismatched.cacheOwner.state !== "resolved") {
      throw new Error("fixture must have a resolved cache owner");
    }
    mismatched.cacheOwner = {
      ...mismatched.cacheOwner,
      principalKey: "principal-b",
    };
    await expect(
      ingestRecoverySnapshot(repository, namespace, mismatched),
    ).rejects.toThrow("principal does not match");
    await expect(
      repository.getObservedRecord(
        namespace.namespaceId,
        RECOVERY_SIDEBAR_RECORD_KEY,
      ),
    ).resolves.toBeNull();
    await repository.close();
  });

  it("rolls back the whole observed-record batch on a foreign-key failure", async () => {
    const repository = await createRepository();
    await repository.ensureNamespace({
      namespaceId: "valid",
      serverProfileKey: "profile-a",
      ownerKey: "principal-a",
      ownerState: "resolved",
    });
    await expect(
      repository.putObservedRecords([
        {
          namespaceId: "valid",
          recordKey: "first",
          payload: { value: 1 },
          revision: 1,
          updatedAt: 1,
        },
        {
          namespaceId: "missing",
          recordKey: "second",
          payload: { value: 2 },
          revision: 1,
          updatedAt: 1,
        },
      ]),
    ).rejects.toThrow();
    await expect(
      repository.getObservedRecord("valid", "first"),
    ).resolves.toBeNull();
    await repository.close();
  });
});
