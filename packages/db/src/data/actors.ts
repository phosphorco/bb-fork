import { and, eq } from "drizzle-orm";
import type { P6rActorSnapshot } from "@bb/domain";
import type { DbConnection, DbQueryConnection } from "../connection.js";
import { p6rActors } from "../schema.js";

export type P6rActorRow = typeof p6rActors.$inferSelect;

export function p6rUpsertActorSnapshot(
  db: DbConnection,
  actor: P6rActorSnapshot,
  now: number,
): P6rActorRow {
  return db
    .insert(p6rActors)
    .values({
      p6rProviderId: actor.p6rProviderId,
      p6rSubject: actor.p6rSubject,
      p6rHandle: actor.p6rHandle,
      p6rDisplayName: actor.p6rDisplayName,
      p6rImageUrl: actor.p6rImageUrl,
      p6rFirstSeenAt: now,
      p6rLastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: [p6rActors.p6rProviderId, p6rActors.p6rSubject],
      set: {
        p6rHandle: actor.p6rHandle,
        p6rDisplayName: actor.p6rDisplayName,
        p6rImageUrl: actor.p6rImageUrl,
        p6rLastSeenAt: now,
      },
    })
    .returning()
    .get();
}

export function p6rGetActorSnapshot(
  db: DbQueryConnection,
  principal: { p6rProviderId: string; p6rSubject: string },
): P6rActorSnapshot | null {
  const row = db
    .select()
    .from(p6rActors)
    .where(
      and(
        eq(p6rActors.p6rProviderId, principal.p6rProviderId),
        eq(p6rActors.p6rSubject, principal.p6rSubject),
      ),
    )
    .get();
  return row
    ? {
        p6rProviderId: row.p6rProviderId,
        p6rSubject: row.p6rSubject,
        p6rHandle: row.p6rHandle,
        p6rDisplayName: row.p6rDisplayName,
        p6rImageUrl: row.p6rImageUrl,
      }
    : null;
}
