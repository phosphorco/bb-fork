import type { SidebarTopLevelSectionId } from "./sidebarCollapsedAtoms";

export function reorderSidebarTopLevelOrder({
  activeId,
  overId,
  order,
}: {
  activeId: string;
  overId: string;
  order: readonly SidebarTopLevelSectionId[];
}): SidebarTopLevelSectionId[] | null {
  const activeIndex = order.indexOf(activeId as SidebarTopLevelSectionId);
  const overIndex = order.indexOf(overId as SidebarTopLevelSectionId);
  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
    return null;
  }

  const nextOrder = [...order];
  const [active] = nextOrder.splice(activeIndex, 1);
  if (active === undefined) return null;
  nextOrder.splice(overIndex, 0, active);
  return nextOrder;
}
