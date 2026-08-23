import { eq } from "drizzle-orm";
import type { DbConnection } from "../connection.js";
import { p6rCollaborators } from "../schema.js";

export interface P6rUpsertCollaboratorInput {
  p6rHandle: string;
  p6rDisplayName: string;
  p6rImageUrl: string | null;
}

export type P6rCollaboratorRow = typeof p6rCollaborators.$inferSelect;

export function p6rUpsertCollaborator(
  db: DbConnection,
  input: P6rUpsertCollaboratorInput,
  now: number,
): P6rCollaboratorRow {
  return db
    .insert(p6rCollaborators)
    .values({
      p6rHandle: input.p6rHandle,
      p6rDisplayName: input.p6rDisplayName,
      p6rImageUrl: input.p6rImageUrl,
      p6rFirstSeenAt: now,
      p6rLastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: p6rCollaborators.p6rHandle,
      set: {
        p6rDisplayName: input.p6rDisplayName,
        p6rImageUrl: input.p6rImageUrl,
        p6rLastSeenAt: now,
      },
    })
    .returning()
    .get();
}

export function p6rGetCollaborator(
  db: DbConnection,
  handle: string,
): P6rCollaboratorRow | null {
  return (
    db
      .select()
      .from(p6rCollaborators)
      .where(eq(p6rCollaborators.p6rHandle, handle))
      .get() ?? null
  );
}

export function p6rListCollaborators(db: DbConnection): P6rCollaboratorRow[] {
  return db.select().from(p6rCollaborators).all();
}
