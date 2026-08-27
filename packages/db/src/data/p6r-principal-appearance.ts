import { desc, eq, like } from "drizzle-orm";
import type { FaviconColorPreference, P6rActorSnapshot } from "@bb/domain";
import type { DbConnection, DbQueryConnection } from "../connection.js";
import { appTheme, p6rActors } from "../schema.js";

// Personal palette choices reuse the `app_theme` table: the shared default
// stays in the singleton "current" row while each explicit per-person choice
// is stored under a downstream-namespaced row id derived from that person's
// serialized PrincipalKey, so no schema change is required. The local operator
// never gets a personal row — their writes stay on the global row so the CLI,
// single-user installs, and existing data keep exactly one meaning.

const P6R_PERSONAL_APP_THEME_ROW_PREFIX = "p6r-appearance:";

function p6rPersonalAppearanceRowId(p6rPrincipalKey: string): string {
  return `${P6R_PERSONAL_APP_THEME_ROW_PREFIX}${p6rPrincipalKey}`;
}

export interface P6rStoredPrincipalAppearance {
  themeId: string;
  faviconColor: FaviconColorPreference;
}

export function p6rGetStoredAppearanceForPrincipalKey(
  db: DbQueryConnection,
  p6rPrincipalKey: string,
): P6rStoredPrincipalAppearance | null {
  const row = db
    .select({ themeId: appTheme.themeId, faviconColor: appTheme.faviconColor })
    .from(appTheme)
    .where(eq(appTheme.id, p6rPersonalAppearanceRowId(p6rPrincipalKey)))
    .get();
  return row ?? null;
}

export function p6rSetStoredAppearanceForPrincipalKey(
  db: DbConnection,
  p6rPrincipalKey: string,
  appearance: P6rStoredPrincipalAppearance,
): void {
  const updatedAt = Date.now();
  const { themeId, faviconColor } = appearance;
  db.insert(appTheme)
    .values({
      id: p6rPersonalAppearanceRowId(p6rPrincipalKey),
      themeId,
      faviconColor,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: appTheme.id,
      set: { themeId, faviconColor, updatedAt },
    })
    .run();
}

/** Drop a personal override so the person follows the shared row again. */
export function p6rClearStoredAppearanceForPrincipalKey(
  db: DbConnection,
  p6rPrincipalKey: string,
): void {
  db.delete(appTheme)
    .where(eq(appTheme.id, p6rPersonalAppearanceRowId(p6rPrincipalKey)))
    .run();
}

/** Every stored personal palette row (the global "current" row excluded). */
export function p6rListStoredPrincipalAppearance(
  db: DbQueryConnection,
): Array<{ p6rPrincipalKey: string; themeId: string }> {
  return db
    .select({ id: appTheme.id, themeId: appTheme.themeId })
    .from(appTheme)
    .where(like(appTheme.id, `${P6R_PERSONAL_APP_THEME_ROW_PREFIX}%`))
    .all()
    .map((row) => ({
      p6rPrincipalKey: row.id.slice(P6R_PERSONAL_APP_THEME_ROW_PREFIX.length),
      themeId: row.themeId,
    }));
}

/** Bounds the Settings palette roster on servers with a long actor history. */
export const P6R_PALETTE_ROSTER_ACTOR_LIMIT = 32;

export function p6rListRecentActorSnapshots(
  db: DbQueryConnection,
): P6rActorSnapshot[] {
  return db
    .select({
      p6rProviderId: p6rActors.p6rProviderId,
      p6rSubject: p6rActors.p6rSubject,
      p6rHandle: p6rActors.p6rHandle,
      p6rDisplayName: p6rActors.p6rDisplayName,
      p6rImageUrl: p6rActors.p6rImageUrl,
    })
    .from(p6rActors)
    .orderBy(desc(p6rActors.p6rLastSeenAt))
    .limit(P6R_PALETTE_ROSTER_ACTOR_LIMIT)
    .all();
}
