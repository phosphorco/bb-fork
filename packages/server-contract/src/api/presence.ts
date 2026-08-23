import { p6rPresenceViewerSchema } from "@bb/domain";
import { z } from "zod";

/**
 * Complete current ephemeral viewer rosters, keyed by thread id.
 *
 * Unlike this HTTP snapshot, realtime `p6r-presence-summary` messages are partial
 * patches: merge each supplied thread entry into the local summary, and remove
 * an entry when its supplied handle array is empty.
 */
export const p6rPresenceSnapshotResponseSchema = z
  .object({
    p6rThreads: z.record(
      z.string(),
      z.array(p6rPresenceViewerSchema).readonly(),
    ),
  })
  .strict();

export type P6rPresenceSnapshotResponse = z.infer<
  typeof p6rPresenceSnapshotResponseSchema
>;
