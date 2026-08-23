import { useCallback, type ReactNode } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import type { ConsumeDragClickSuppression } from "@/components/ui/use-drag-click-suppression";
import type { SidebarTopLevelSectionId } from "./sidebarCollapsedAtoms";
import { SidebarSectionOrderList } from "./SidebarSectionOrderList";
import { useSidebarReorderDnd } from "./useSidebarReorderDnd";
import { reorderSidebarTopLevelOrder } from "./sidebarTopLevelOrder";

interface ReorderableSidebarSectionOrderListProps {
  children: (
    sectionId: SidebarTopLevelSectionId,
    consumeClickSuppression: ConsumeDragClickSuppression,
  ) => ReactNode;
  onOrderChange: (order: SidebarTopLevelSectionId[]) => void;
  order: readonly SidebarTopLevelSectionId[];
  reorderOrder?: readonly SidebarTopLevelSectionId[];
}

export function ReorderableSidebarSectionOrderList({
  children,
  onOrderChange,
  order,
  reorderOrder = order,
}: ReorderableSidebarSectionOrderListProps) {
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (
        !event.over ||
        typeof event.active.id !== "string" ||
        typeof event.over.id !== "string"
      ) {
        return;
      }
      const nextOrder = reorderSidebarTopLevelOrder({
        activeId: event.active.id,
        overId: event.over.id,
        order: reorderOrder,
      });
      if (nextOrder) onOrderChange(nextOrder);
    },
    [onOrderChange, reorderOrder],
  );
  const { dndContextProps, consumeClickSuppression } = useSidebarReorderDnd({
    onDragEnd: handleDragEnd,
  });

  return (
    <SidebarSectionOrderList order={order} dndContextProps={dndContextProps}>
      {(sectionId) => children(sectionId, consumeClickSuppression)}
    </SidebarSectionOrderList>
  );
}
