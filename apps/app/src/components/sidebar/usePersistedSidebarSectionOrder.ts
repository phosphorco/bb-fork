import { useEffect, useMemo } from "react";
import {
  MY_PROGRESS_SIDEBAR_SECTION_ID,
  type SidebarSectionId,
  type SidebarTopLevelSectionId,
} from "./sidebarCollapsedAtoms";
import {
  normalizeSidebarSectionOrder,
  type LegacySidebarEntityAnchor,
} from "@bb/client-core";

interface UsePersistedSidebarSectionOrderArgs {
  entitySectionIds: readonly SidebarSectionId[];
  hasPinnedSection: boolean;
  hasThreadsSection?: boolean;
  isReady: boolean;
  legacyEntityAnchor: LegacySidebarEntityAnchor;
  setStoredOrder: (order: string[]) => void;
  storedOrder: readonly string[];
}

interface ResolveSidebarTopLevelSectionOrderArgs {
  entitySectionIds: readonly SidebarSectionId[];
  hasPinnedSection: boolean;
  hasThreadsSection?: boolean;
  legacyEntityAnchor: LegacySidebarEntityAnchor;
  storedOrder: readonly string[];
}

/**
 * Reconciles entity-owned sections first, then places the saved-query view
 * beside its nearest surviving stored neighbor. The view id never enters the
 * entity-section normalizer, so it cannot alias a project, machine, or authored
 * thread section.
 */
export function resolveSidebarTopLevelSectionOrder({
  entitySectionIds,
  hasPinnedSection,
  hasThreadsSection,
  legacyEntityAnchor,
  storedOrder,
}: ResolveSidebarTopLevelSectionOrderArgs): SidebarTopLevelSectionId[] {
  const entityOrder = normalizeSidebarSectionOrder({
    storedOrder: storedOrder.filter(
      (sectionId) => sectionId !== MY_PROGRESS_SIDEBAR_SECTION_ID,
    ),
    entitySectionIds,
    legacyEntityAnchor,
    hasPinnedSection,
    ...(hasThreadsSection === undefined ? {} : { hasThreadsSection }),
  });
  const savedViewIndex = storedOrder.indexOf(MY_PROGRESS_SIDEBAR_SECTION_ID);

  if (savedViewIndex < 0) {
    const pinnedIndex = entityOrder.indexOf("pinned");
    const insertionIndex = pinnedIndex < 0 ? 0 : pinnedIndex + 1;
    return [
      ...entityOrder.slice(0, insertionIndex),
      MY_PROGRESS_SIDEBAR_SECTION_ID,
      ...entityOrder.slice(insertionIndex),
    ];
  }

  const entityIds = new Set<string>(entityOrder);
  const entityIndexById = new Map<string, number>(
    entityOrder.map((sectionId, index) => [sectionId, index]),
  );
  for (let index = savedViewIndex - 1; index >= 0; index -= 1) {
    const precedingId = storedOrder[index];
    if (precedingId !== undefined && entityIds.has(precedingId)) {
      const insertionIndex = (entityIndexById.get(precedingId) ?? -1) + 1;
      return [
        ...entityOrder.slice(0, insertionIndex),
        MY_PROGRESS_SIDEBAR_SECTION_ID,
        ...entityOrder.slice(insertionIndex),
      ];
    }
  }
  for (let index = savedViewIndex + 1; index < storedOrder.length; index += 1) {
    const followingId = storedOrder[index];
    if (followingId !== undefined && entityIds.has(followingId)) {
      const insertionIndex = entityIndexById.get(followingId) ?? 0;
      return [
        ...entityOrder.slice(0, insertionIndex),
        MY_PROGRESS_SIDEBAR_SECTION_ID,
        ...entityOrder.slice(insertionIndex),
      ];
    }
  }

  return [MY_PROGRESS_SIDEBAR_SECTION_ID, ...entityOrder];
}

export function haveSameOrder(
  left: readonly string[],
  right: readonly string[],
) {
  return (
    left.length === right.length &&
    left.every((sectionId, index) => sectionId === right[index])
  );
}

export function usePersistedSidebarSectionOrder({
  entitySectionIds,
  hasPinnedSection,
  hasThreadsSection,
  isReady,
  legacyEntityAnchor,
  setStoredOrder,
  storedOrder,
}: UsePersistedSidebarSectionOrderArgs): SidebarTopLevelSectionId[] {
  const order = useMemo(
    () =>
      resolveSidebarTopLevelSectionOrder({
        storedOrder,
        entitySectionIds,
        legacyEntityAnchor,
        hasPinnedSection,
        ...(hasThreadsSection === undefined ? {} : { hasThreadsSection }),
      }),
    [
      entitySectionIds,
      hasPinnedSection,
      hasThreadsSection,
      legacyEntityAnchor,
      storedOrder,
    ],
  );

  useEffect(() => {
    if (!isReady || haveSameOrder(storedOrder, order)) return;
    setStoredOrder(order);
  }, [isReady, order, setStoredOrder, storedOrder]);

  return order;
}
