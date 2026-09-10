import {
  RECOVERY_SNAPSHOT_CONTRACT_VERSION,
  RECOVERY_SNAPSHOT_MAX_SEGMENT_LIMIT,
  RECOVERY_SNAPSHOT_MAX_THREAD_COUNT,
  recoverySnapshotCacheOwnerSchema,
  recoverySnapshotRequestSchema,
} from "@bb/server-contract";
import { describe, expect, it } from "vitest";

describe("recovery snapshot contract", () => {
  it("bounds both fan-out axes and rejects duplicate thread work", () => {
    const baseline = {
      contractVersion: RECOVERY_SNAPSHOT_CONTRACT_VERSION,
      threadIds: ["thread-a"],
      timelineSegmentLimit: RECOVERY_SNAPSHOT_MAX_SEGMENT_LIMIT,
    } as const;
    expect(recoverySnapshotRequestSchema.safeParse(baseline).success).toBe(
      true,
    );
    expect(
      recoverySnapshotRequestSchema.safeParse({
        ...baseline,
        threadIds: Array.from(
          { length: RECOVERY_SNAPSHOT_MAX_THREAD_COUNT + 1 },
          (_, index) => `thread-${index}`,
        ),
      }).success,
    ).toBe(false);
    expect(
      recoverySnapshotRequestSchema.safeParse({
        ...baseline,
        timelineSegmentLimit: RECOVERY_SNAPSHOT_MAX_SEGMENT_LIMIT + 1,
      }).success,
    ).toBe(false);
    expect(
      recoverySnapshotRequestSchema.safeParse({
        ...baseline,
        threadIds: ["thread-a", "thread-a"],
      }).success,
    ).toBe(false);
  });

  it("cannot pair a read-only cache namespace with an asserted principal", () => {
    expect(
      recoverySnapshotCacheOwnerSchema.safeParse({
        state: "read-only",
        principalKey: "principal-a",
        actor: null,
      }).success,
    ).toBe(false);
  });
});
