import {
  getStoredFaviconColor,
  getStoredThemeId,
  p6rGetStoredAppearanceForPrincipalKey,
  p6rListRecentActorSnapshots,
  p6rListStoredPrincipalAppearance,
  type DbConnection,
  type P6rStoredPrincipalAppearance,
} from "@bb/db";
import type { P6rActorSnapshot, P6rPrincipalKey } from "@bb/domain";
import type { P6rPaletteRosterEntry } from "@bb/server-contract";
import {
  P6R_LOCAL_OPERATOR_PROVIDER_ID,
  p6rPrincipalKeyForActor,
} from "../identity.js";

/**
 * The `app_theme` row a person's palette writes land on: their PrincipalKey
 * for provider-established or claimed principals, null (the shared global
 * "current" row) for the local operator and unclaimed requests. Keeping the
 * local operator on the global row preserves the single-user, CLI, and
 * pre-existing semantics unchanged.
 */
export function p6rPersonalAppearanceKey(
  p6rPrincipal: P6rActorSnapshot | null,
): P6rPrincipalKey | null {
  if (p6rPrincipal === null) return null;
  if (p6rPrincipal.p6rProviderId === P6R_LOCAL_OPERATOR_PROVIDER_ID) {
    return null;
  }
  return p6rPrincipalKeyForActor(p6rPrincipal);
}

/**
 * The palette selection this person should see: their stored personal choice
 * when one exists, else the shared global row.
 */
export function p6rResolveAppearanceSelection(
  db: DbConnection,
  p6rPrincipal: P6rActorSnapshot | null,
): P6rStoredPrincipalAppearance {
  const p6rKey = p6rPersonalAppearanceKey(p6rPrincipal);
  const personal =
    p6rKey === null ? null : p6rGetStoredAppearanceForPrincipalKey(db, p6rKey);
  return (
    personal ?? {
      themeId: getStoredThemeId(db),
      faviconColor: getStoredFaviconColor(db),
    }
  );
}

/**
 * Each recently seen person's palette choice for the Settings roster. A null
 * `themeId` means the person follows the shared default; the local operator's
 * entry reflects the global row, which is where their writes land.
 */
export function p6rBuildPaletteRoster(
  db: DbConnection,
): P6rPaletteRosterEntry[] {
  const personalThemeIds = new Map(
    p6rListStoredPrincipalAppearance(db).map((row) => [
      row.p6rPrincipalKey,
      row.themeId,
    ]),
  );
  const globalThemeId = getStoredThemeId(db);
  return p6rListRecentActorSnapshots(db).map((actor) => {
    const p6rPrincipalKey = p6rPrincipalKeyForActor(actor);
    const themeId =
      actor.p6rProviderId === P6R_LOCAL_OPERATOR_PROVIDER_ID
        ? globalThemeId
        : (personalThemeIds.get(p6rPrincipalKey) ?? null);
    return {
      p6rPrincipalKey,
      p6rHandle: actor.p6rHandle,
      p6rDisplayName: actor.p6rDisplayName,
      p6rImageUrl: actor.p6rImageUrl,
      themeId,
    };
  });
}
