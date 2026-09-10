import { threadScope } from "@bb/domain";
import {
  RECOVERY_SNAPSHOT_CONTRACT_VERSION,
  recoverySnapshotResponseSchema,
} from "@bb/server-contract";
import { describe, expect, it } from "vitest";
import { readJson } from "../helpers/json.js";
import { seedEvent, seedThreadFixture } from "../helpers/seed.js";
import { withTestHarness } from "../helpers/test-app.js";

describe("POST /recovery/snapshot", () => {
  it("returns a principal-fenced bounded timeline observation without claiming global coherence", async () => {
    await withTestHarness(async (harness) => {
      const { environment, thread } = seedThreadFixture(harness);
      seedEvent(harness.deps, {
        threadId: thread.id,
        environmentId: environment.id,
        sequence: 1,
        type: "system/manager/user_message",
        scope: threadScope(),
        data: { text: "cached recovery context" },
      });

      const response = await harness.app.request("/api/v1/recovery/snapshot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contractVersion: RECOVERY_SNAPSHOT_CONTRACT_VERSION,
          threadIds: [thread.id, "missing-thread"],
          timelineSegmentLimit: 20,
        }),
      });

      expect(response.status).toBe(200);
      const snapshot = recoverySnapshotResponseSchema.parse(
        await readJson(response),
      );
      expect(snapshot.consistency).toBe("partial");
      expect(snapshot.incompleteReasons).toEqual([
        "sidebar-revision-unavailable",
      ]);
      expect(snapshot.cacheOwner.state).toBe("resolved");
      expect(snapshot.timelines).toHaveLength(1);
      expect(snapshot.timelines[0]).toMatchObject({
        threadId: thread.id,
        consistency: "coherent",
        headSequence: 1,
        projectionCoverage: "windowed",
        olderCursor: null,
      });
      expect(snapshot.timelines[0]?.timeline.maxSeq).toBe(1);
      expect(snapshot.unavailableThreads).toEqual([
        { threadId: "missing-thread", reason: "not-found" },
      ]);
      expect(
        snapshot.sidebar.projects.some(
          (project) => project.id === thread.projectId,
        ),
      ).toBe(true);
    });
  });

  it("rejects duplicate thread work at the HTTP boundary", async () => {
    await withTestHarness(async (harness) => {
      const response = await harness.app.request("/api/v1/recovery/snapshot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contractVersion: RECOVERY_SNAPSHOT_CONTRACT_VERSION,
          threadIds: ["same", "same"],
          timelineSegmentLimit: 20,
        }),
      });
      expect(response.status).toBe(400);
    });
  });
});
