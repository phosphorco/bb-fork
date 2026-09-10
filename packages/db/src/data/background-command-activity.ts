import { inArray, sql } from "drizzle-orm";
import {
  LOCAL_BASH_TASK_TYPE,
  type ThreadEventItemType,
  type ThreadEventType,
} from "@bb/domain";
import type { DbQueryConnection } from "../connection.js";
import { events } from "../schema.js";
import { queryInSqliteVariableBatches } from "./events.js";

interface ActiveBackgroundCommandStartRow {
  newestActiveBackgroundCommandStartedAt: number;
  threadId: string;
}

interface ListActiveBackgroundCommandStartsByThreadIdsArgs {
  threadIds: readonly string[];
}

/**
 * Newest start among each thread's open provider-backgrounded shell commands.
 * Consumers use the newest start so parallel commands only become quiet once
 * every command has crossed their age threshold.
 *
 * The caller first narrows this to threads whose aggregate activity reports an
 * active command, keeping the second list query proportional to the rare rows
 * that need age-sensitive presentation.
 */
export function p6rListActiveBackgroundCommandStartsByThreadIds(
  db: DbQueryConnection,
  args: ListActiveBackgroundCommandStartsByThreadIdsArgs,
): ActiveBackgroundCommandStartRow[] {
  const rows = queryInSqliteVariableBatches({
    dedupeKey: (threadId) => threadId,
    fixedVariableCount: 8,
    queryBatch: (threadIds) => {
      const startedType = "item/started" satisfies ThreadEventType;
      const progressType =
        "item/backgroundTask/progress" satisfies ThreadEventType;
      const completedType =
        "item/backgroundTask/completed" satisfies ThreadEventType;
      const backgroundTaskItemKind =
        "backgroundTask" satisfies ThreadEventItemType;
      const backgroundTaskItemKindPredicate = sql.raw(
        `= '${backgroundTaskItemKind}'`,
      );

      return db.all<ActiveBackgroundCommandStartRow>(sql`
        WITH latest_background_command_state AS (
          SELECT
            ${events.threadId} AS thread_id,
            ${events.itemId} AS item_id,
            MAX(
              CASE
                WHEN ${events.type} = ${startedType}
                  THEN ${events.createdAt}
                ELSE NULL
              END
            ) AS started_at,
            MAX(
              CASE
                WHEN ${inArray(events.type, [startedType, progressType])}
                  THEN ${events.sequence}
                ELSE NULL
              END
            ) AS sequence,
            MAX(
              CASE
                WHEN ${events.type} = ${completedType} THEN 1
                ELSE 0
              END
            ) AS is_completed
          FROM ${events} INDEXED BY events_background_task_thread_type_item_sequence_idx
          WHERE ${inArray(events.threadId, [...threadIds])}
            AND ${events.itemKind} ${backgroundTaskItemKindPredicate}
            AND ${inArray(events.type, [startedType, progressType, completedType])}
            AND ${events.itemId} IS NOT NULL
          GROUP BY ${events.threadId}, ${events.itemId}
        )
        SELECT
          active_event.thread_id AS threadId,
          MAX(latest.started_at) AS newestActiveBackgroundCommandStartedAt
        FROM latest_background_command_state latest
        JOIN events active_event
          ON active_event.thread_id = latest.thread_id
          AND active_event.sequence = latest.sequence
        WHERE latest.is_completed = 0
          AND latest.sequence IS NOT NULL
          AND latest.started_at IS NOT NULL
          AND json_extract(active_event.data, '$.item.status') = 'pending'
          AND json_extract(active_event.data, '$.item.taskType') =
            ${LOCAL_BASH_TASK_TYPE}
          AND COALESCE(
            json_extract(active_event.data, '$.item.skipTranscript'),
            0
          ) = 0
        GROUP BY active_event.thread_id
        ORDER BY active_event.thread_id
      `);
    },
    values: args.threadIds,
    variableCountPerValue: 1,
  });

  return rows.sort((left, right) =>
    left.threadId.localeCompare(right.threadId),
  );
}
