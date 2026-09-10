import {
  normalizeSidebarSectionOrder,
  type LegacySidebarEntityAnchor,
  type SidebarSectionId,
} from "@bb/client-core";
import { useEffect, useMemo } from "react";
import type { SidebarModel } from "./sidebar-model";
import type {
  SidebarOrganizeMode,
  SidebarPreferences,
} from "./sidebar-preferences";
import type { SidebarPreferenceActions } from "./use-sidebar-preferences";

export const MY_PROGRESS_SIDEBAR_SECTION_ID = "facet-triage:my-progress";
export type MobileSidebarSectionId =
  | SidebarSectionId
  | typeof MY_PROGRESS_SIDEBAR_SECTION_ID;

/**
 * Web `useSidebarModeSectionOrder`: the stored order of each mode can still
 * hold the old aggregate token ("projects" / "sections" / "machines") that
 * stood for every entity section at once.
 */
const LEGACY_ENTITY_ANCHOR: Record<
  SidebarOrganizeMode,
  LegacySidebarEntityAnchor
> = {
  project: "projects",
  manual: "sections",
  machine: "machines",
};

/**
 * The top-level sections of a model in display order: the stored order
 * reconciled with the live groups (new sections join after the last entity;
 * Pinned stays in the order even while nothing is pinned so its placement
 * survives). Pure; the hook below persists the result back like the web.
 */
export function resolveSidebarSectionOrder(
  model: {
    organize: SidebarOrganizeMode;
    groups: readonly { id: SidebarSectionId }[];
  },
  storedOrder: readonly string[],
): MobileSidebarSectionId[] {
  const legacyOrder = normalizeSidebarSectionOrder({
    storedOrder: storedOrder.filter(
      (id) => id !== MY_PROGRESS_SIDEBAR_SECTION_ID,
    ),
    entitySectionIds: model.groups
      .map((group) => group.id)
      .filter(
        (id): id is Exclude<SidebarSectionId, "threads"> => id !== "threads",
      ),
    legacyEntityAnchor: LEGACY_ENTITY_ANCHOR[model.organize],
    hasPinnedSection: true,
    hasThreadsSection: true,
  });

  const savedIndex = storedOrder.indexOf(MY_PROGRESS_SIDEBAR_SECTION_ID);
  if (savedIndex < 0) {
    const pinnedIndex = legacyOrder.indexOf("pinned");
    const insertionIndex = pinnedIndex < 0 ? 0 : pinnedIndex + 1;
    return [
      ...legacyOrder.slice(0, insertionIndex),
      MY_PROGRESS_SIDEBAR_SECTION_ID,
      ...legacyOrder.slice(insertionIndex),
    ];
  }

  const legacyIds = new Set<string>(legacyOrder);
  const legacyIndexById = new Map<string, number>(
    legacyOrder.map((id, index) => [id, index]),
  );
  for (let index = savedIndex - 1; index >= 0; index -= 1) {
    const preceding = storedOrder[index];
    const precedingIndex =
      preceding === undefined ? -1 : (legacyIndexById.get(preceding) ?? -1);
    if (preceding !== undefined && legacyIds.has(preceding)) {
      return [
        ...legacyOrder.slice(0, precedingIndex + 1),
        MY_PROGRESS_SIDEBAR_SECTION_ID,
        ...legacyOrder.slice(precedingIndex + 1),
      ];
    }
  }
  for (let index = savedIndex + 1; index < storedOrder.length; index += 1) {
    const following = storedOrder[index];
    const followingIndex =
      following === undefined ? -1 : (legacyIndexById.get(following) ?? -1);
    if (following !== undefined && legacyIds.has(following)) {
      return [
        ...legacyOrder.slice(0, followingIndex),
        MY_PROGRESS_SIDEBAR_SECTION_ID,
        ...legacyOrder.slice(followingIndex),
      ];
    }
  }
  return [MY_PROGRESS_SIDEBAR_SECTION_ID, ...legacyOrder];
}

export interface SidebarSectionOrderEntry {
  id: MobileSidebarSectionId;
  label: string;
  threadCount: number | null;
}

/**
 * The sections the user can reorder, labelled, in the given order. Pinned is
 * listed only while something is pinned (it is hidden in the list too);
 * `mergeHiddenSectionOrder` keeps its stored slot across a reorder.
 */
export function listSidebarSectionOrderEntries(
  model: SidebarModel,
  order: readonly MobileSidebarSectionId[],
  facetTriageThreadCount: number | null = null,
): SidebarSectionOrderEntry[] {
  const groupsById = new Map(model.groups.map((group) => [group.id, group]));
  const entries: SidebarSectionOrderEntry[] = [];
  for (const id of order) {
    if (id === MY_PROGRESS_SIDEBAR_SECTION_ID) {
      entries.push({
        id,
        label: "My progress",
        threadCount: facetTriageThreadCount,
      });
      continue;
    }
    if (id === "pinned") {
      if (model.pinned) {
        entries.push({
          id,
          label: "Pinned",
          threadCount: model.pinned.threads.length,
        });
      }
      continue;
    }
    const group = groupsById.get(id);
    if (!group) continue;
    entries.push({ id, label: group.label, threadCount: group.threads.length });
  }
  return entries;
}

/**
 * A reorder of the visible sections applied to the full order: sections the
 * user could not see (hidden Pinned) stay at their previous index, so moving
 * what is visible never silently relocates what is not.
 */
export function mergeHiddenSectionOrder(
  fullOrder: readonly MobileSidebarSectionId[],
  visibleOrder: readonly MobileSidebarSectionId[],
): MobileSidebarSectionId[] {
  const visible = new Set(visibleOrder);
  const merged: MobileSidebarSectionId[] = [];
  let nextVisible = 0;
  for (const id of fullOrder) {
    if (visible.has(id)) {
      const replacement = visibleOrder[nextVisible];
      nextVisible += 1;
      if (replacement !== undefined) merged.push(replacement);
    } else {
      merged.push(id);
    }
  }
  return merged;
}

function haveSameOrder(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((id, index) => id === right[index])
  );
}

/**
 * The resolved section order for the model's organize mode. Once the model is
 * ready, the normalized order is written back so the stored value stops
 * carrying legacy anchors and stale ids (web `usePersistedSidebarSectionOrder`).
 */
export function useSidebarSectionOrder(
  model: SidebarModel,
  preferences: SidebarPreferences,
  actions: Pick<SidebarPreferenceActions, "setSectionOrder">,
): MobileSidebarSectionId[] {
  const storedOrder = preferences.sectionOrder[model.organize];
  const order = useMemo(
    () => resolveSidebarSectionOrder(model, storedOrder),
    [model, storedOrder],
  );
  const { setSectionOrder } = actions;
  const organize = model.organize;
  const isReady = model.isReady;
  useEffect(() => {
    if (!isReady || haveSameOrder(storedOrder, order)) return;
    setSectionOrder(organize, order);
  }, [isReady, order, organize, setSectionOrder, storedOrder]);
  return order;
}
