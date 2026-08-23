import type { ReactNode } from "react";
import { DndContext } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { SidebarTopLevelSectionId } from "./sidebarCollapsedAtoms";
import type { SidebarReorderDndContextProps } from "./useSidebarReorderDnd";

interface SidebarSectionOrderListProps {
  children: (sectionId: SidebarTopLevelSectionId) => ReactNode;
  dndContextProps?: SidebarReorderDndContextProps;
  order: readonly SidebarTopLevelSectionId[];
}

export function SidebarSectionOrderList({
  children,
  dndContextProps,
  order,
}: SidebarSectionOrderListProps) {
  const content = (
    <SortableContext items={[...order]} strategy={verticalListSortingStrategy}>
      <div className="space-y-4">{order.map(children)}</div>
    </SortableContext>
  );

  return dndContextProps ? (
    <DndContext {...dndContextProps}>{content}</DndContext>
  ) : (
    content
  );
}
