import { p6rActorSnapshotSchema } from "@bb/domain";
import { z } from "zod";
import { sidebarBootstrapResponseSchema } from "./projects.js";
import {
  timelinePaginationCursorSchema,
  threadTimelineResponseSchema,
} from "./threads.js";

export const RECOVERY_SNAPSHOT_CONTRACT_VERSION = 1;
export const RECOVERY_SNAPSHOT_MAX_THREAD_COUNT = 12;
export const RECOVERY_SNAPSHOT_MAX_SEGMENT_LIMIT = 40;

export const recoverySnapshotRequestSchema = z
  .object({
    contractVersion: z.literal(RECOVERY_SNAPSHOT_CONTRACT_VERSION),
    threadIds: z
      .array(z.string().min(1))
      .max(RECOVERY_SNAPSHOT_MAX_THREAD_COUNT),
    timelineSegmentLimit: z
      .number()
      .int()
      .positive()
      .max(RECOVERY_SNAPSHOT_MAX_SEGMENT_LIMIT),
  })
  .strict()
  .superRefine((request, context) => {
    if (new Set(request.threadIds).size === request.threadIds.length) return;
    context.addIssue({
      code: "custom",
      message: "threadIds must not contain duplicates",
      path: ["threadIds"],
    });
  });
export type RecoverySnapshotRequest = z.infer<
  typeof recoverySnapshotRequestSchema
>;

export const recoverySnapshotCacheOwnerSchema = z.discriminatedUnion("state", [
  z
    .object({
      state: z.literal("resolved"),
      principalKey: z.string().min(1),
      actor: p6rActorSnapshotSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal("read-only"),
      principalKey: z.null(),
      actor: z.null(),
    })
    .strict(),
]);

export const recoveryTimelineObservationSchema = z
  .object({
    threadId: z.string().min(1),
    consistency: z.enum(["coherent", "retry"]),
    headSequence: z.number().int().nonnegative(),
    projectionCoverage: z.enum(["complete", "windowed"]),
    olderCursor: timelinePaginationCursorSchema.nullable(),
    timeline: threadTimelineResponseSchema,
  })
  .strict();
export type RecoveryTimelineObservation = z.infer<
  typeof recoveryTimelineObservationSchema
>;

export const recoverySnapshotUnavailableThreadSchema = z
  .object({
    threadId: z.string().min(1),
    reason: z.literal("not-found"),
  })
  .strict();

export const recoverySnapshotResponseSchema = z
  .object({
    contractVersion: z.literal(RECOVERY_SNAPSHOT_CONTRACT_VERSION),
    generatedAtMs: z.number().int().nonnegative(),
    consistency: z.enum(["coherent", "partial", "retry"]),
    incompleteReasons: z.array(
      z.enum([
        "sidebar-revision-unavailable",
        "thread-changed-during-snapshot",
      ]),
    ),
    cacheOwner: recoverySnapshotCacheOwnerSchema,
    sidebar: sidebarBootstrapResponseSchema,
    timelines: z.array(recoveryTimelineObservationSchema),
    unavailableThreads: z.array(recoverySnapshotUnavailableThreadSchema),
  })
  .strict();
export type RecoverySnapshotResponse = z.infer<
  typeof recoverySnapshotResponseSchema
>;
