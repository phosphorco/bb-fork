import {
  recoverySnapshotResponseSchema,
  type RecoverySnapshotRequest,
  type RecoverySnapshotResponse,
} from "@bb/server-contract";
import { signalRequestArgs, type CreateSdkAreaArgs } from "./common.js";

export interface RecoverySnapshotArgs extends RecoverySnapshotRequest {
  signal?: AbortSignal;
}

export type RecoverySnapshotResult = RecoverySnapshotResponse;

export interface RecoveryArea {
  /**
   * Read a bounded cache bootstrap. Overall `partial` is intentional until
   * BB can issue one revision spanning sidebar metadata and thread timelines.
   */
  snapshot(args: RecoverySnapshotArgs): Promise<RecoverySnapshotResult>;
}

export function createRecoveryArea({
  transport,
}: CreateSdkAreaArgs): RecoveryArea {
  return {
    async snapshot(input) {
      return recoverySnapshotResponseSchema.parse(
        await transport.readJson(
          transport.api.v1.recovery.snapshot.$post(
            {
              json: {
                contractVersion: input.contractVersion,
                threadIds: input.threadIds,
                timelineSegmentLimit: input.timelineSegmentLimit,
              },
            },
            ...signalRequestArgs(input.signal),
          ),
        ),
      );
    },
  };
}
