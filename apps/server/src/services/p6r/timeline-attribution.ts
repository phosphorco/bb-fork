import { and, eq, inArray } from "drizzle-orm";
import type { DbConnection } from "@bb/db";
import {
  nativeActorSnapshotSchema,
  nativeOriginSchema,
  type NativeInputAttribution,
} from "@bb/domain";
import type { TimelineRow } from "@bb/server-contract";
import {
  p6rAttempts,
  p6rAttemptInputs,
  p6rContributions,
} from "./sidecar-schema.js";

function unknown(): NativeInputAttribution {
  return {
    author: { kind: "unknown", reason: "missing-source" },
    latestEditor: null,
  };
}

function json(value: string | null): unknown {
  if (value === null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function attribution(
  authorJson: string | null,
  editorJson: string | null,
): NativeInputAttribution {
  const value = json(authorJson);
  const origin = nativeOriginSchema.safeParse(value);
  const actor = nativeActorSnapshotSchema.safeParse(value);
  const editor = nativeActorSnapshotSchema.safeParse(json(editorJson));
  let author = unknown().author;
  if (origin.success) author = origin.data;
  else if (actor.success) {
    if (actor.data.identity.kind === "person") {
      author = {
        kind: "person",
        actor: { ...actor.data, identity: actor.data.identity },
      };
    } else {
      author = {
        kind: "external",
        actor: { ...actor.data, identity: actor.data.identity },
      };
    }
  }
  return { author, latestEditor: editor.success ? editor.data : null };
}

export function projectP6rNativeTimelineAttribution(
  db: DbConnection,
  threadId: string,
  rows: readonly TimelineRow[],
): TimelineRow[] {
  const requestIds = new Set<string>();
  const collect = (items: readonly TimelineRow[]) => {
    for (const row of items) {
      if (
        row.kind === "conversation" &&
        row.role === "user" &&
        row.turnRequest.source
      ) {
        requestIds.add(row.turnRequest.source.requestId);
      }
      if ("children" in row && row.children) collect(row.children);
    }
  };
  collect(rows);
  const groups = new Map<string, Map<number, NativeInputAttribution[]>>();
  const attempts = new Map<string, Set<string>>();
  const ids = [...requestIds];
  for (let offset = 0; offset < ids.length; offset += 200) {
    const records = db
      .select({
        requestId: p6rAttempts.nativeRequestId,
        attemptId: p6rAttempts.id,
        groupIndex: p6rAttemptInputs.groupIndex,
        sourceKind: p6rAttemptInputs.sourceKind,
        author: p6rContributions.acceptedAuthorship,
        editor: p6rContributions.latestEditor,
      })
      .from(p6rAttempts)
      .leftJoin(
        p6rAttemptInputs,
        eq(p6rAttemptInputs.attemptId, p6rAttempts.id),
      )
      .leftJoin(
        p6rContributions,
        and(
          eq(p6rContributions.id, p6rAttemptInputs.contributionId),
          eq(p6rContributions.threadId, p6rAttempts.threadId),
        ),
      )
      .where(
        and(
          eq(p6rAttempts.threadId, threadId),
          inArray(p6rAttempts.nativeRequestId, ids.slice(offset, offset + 200)),
        ),
      )
      .orderBy(
        p6rAttempts.id,
        p6rAttemptInputs.groupIndex,
        p6rAttemptInputs.sourceIndex,
      )
      .all();
    for (const record of records) {
      if (record.requestId === null) continue;
      const seen = attempts.get(record.requestId) ?? new Set<string>();
      seen.add(record.attemptId);
      attempts.set(record.requestId, seen);
      if (record.groupIndex === null) continue;
      const requestGroups =
        groups.get(record.requestId) ??
        new Map<number, NativeInputAttribution[]>();
      const sources = requestGroups.get(record.groupIndex) ?? [];
      sources.push(
        record.sourceKind === "contribution"
          ? attribution(record.author, record.editor)
          : unknown(),
      );
      requestGroups.set(record.groupIndex, sources);
      groups.set(record.requestId, requestGroups);
    }
  }
  const decorate = (items: readonly TimelineRow[]): TimelineRow[] =>
    items.map((row) => {
      if (
        row.kind === "conversation" &&
        row.role === "user" &&
        row.turnRequest.source
      ) {
        const { requestId, inputGroupIndex } = row.turnRequest.source;
        const sources =
          attempts.get(requestId)?.size === 1
            ? groups.get(requestId)?.get(inputGroupIndex)
            : undefined;
        return { ...row, attribution: sources?.length ? sources : [unknown()] };
      }
      if ("children" in row && row.children)
        return { ...row, children: decorate(row.children) };
      return row;
    });
  return decorate(rows);
}
