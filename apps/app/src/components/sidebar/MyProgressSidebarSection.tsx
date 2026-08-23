import { useMemo } from "react";
import type { ThreadFacetOwnerState } from "@bb/domain";
import type { ThreadFacetQueryThread } from "@bb/server-contract";
import { Button } from "@bb/shared-ui/button";
import { Skeleton } from "@bb/shared-ui/skeleton";
import { usePromptDraftHasInput } from "@/hooks/usePromptDraftStorage";
import {
  MY_PROGRESS_SAVED_FACET_QUERY,
  useMyProgressFacetQuery,
  type MyProgressFacetPage,
} from "@/hooks/queries/my-progress-query";
import type { ConsumeDragClickSuppression } from "@/components/ui/use-drag-click-suppression";
import { SortableSidebarSection } from "./BuiltInSidebarSection";
import { ThreadRow } from "./ThreadRow";
import { MY_PROGRESS_SIDEBAR_SECTION_ID } from "./sidebarCollapsedAtoms";

export const MY_PROGRESS_LAST_KNOWN_STATUS =
  "Progress unavailable; showing last-known classifications";
export const MY_PROGRESS_UNAVAILABLE_STATUS = "Progress unavailable";

function progressOwnerState(
  page: MyProgressFacetPage,
): ThreadFacetOwnerState | undefined {
  return page.response.facetStates.find(
    (state) => state.typeId === MY_PROGRESS_SAVED_FACET_QUERY.order.typeId,
  )?.ownerState;
}

export function myProgressCollectionStatus(
  pages: readonly MyProgressFacetPage[],
): string | null {
  if (pages.some((page) => page.mode === "participants-only")) {
    return MY_PROGRESS_UNAVAILABLE_STATUS;
  }
  return pages.some((page) => progressOwnerState(page) !== "ready")
    ? MY_PROGRESS_LAST_KNOWN_STATUS
    : null;
}

function MyProgressThreadRow({
  activeThreadId,
  onNavigate,
  thread,
}: {
  activeThreadId?: string;
  onNavigate?: () => void;
  thread: ThreadFacetQueryThread;
}) {
  const hasComposerDraft = usePromptDraftHasInput({
    kind: "thread",
    projectId: thread.projectId,
    threadId: thread.id,
  });

  return (
    <ThreadRow
      projectId={thread.projectId}
      thread={thread}
      crossProjectId={null}
      isActive={activeThreadId === thread.id}
      hasComposerDraft={hasComposerDraft}
      facetParticipantSummary={thread.participantSummary}
      onProjectSelect={onNavigate}
      options={{ kind: "default", depth: 1, isCompact: false }}
    />
  );
}

export function MyProgressSidebarSection({
  activeThreadId,
  consumeClickSuppression,
  disabled,
  isCollapsed,
  onNavigate,
  onToggleCollapsed,
}: {
  activeThreadId?: string;
  consumeClickSuppression?: ConsumeDragClickSuppression;
  disabled: boolean;
  isCollapsed: boolean;
  onNavigate?: () => void;
  onToggleCollapsed: () => void;
}) {
  const query = useMyProgressFacetQuery();
  const pages = query.data?.pages;
  const threads = useMemo(
    () => pages?.flatMap((page) => page.response.threads) ?? [],
    [pages],
  );
  const status = myProgressCollectionStatus(pages ?? []);

  return (
    <SortableSidebarSection
      id={MY_PROGRESS_SIDEBAR_SECTION_ID}
      label={MY_PROGRESS_SAVED_FACET_QUERY.label}
      disabled={disabled}
      collapseControl={{ isCollapsed, onToggleCollapsed }}
      consumeClickSuppression={consumeClickSuppression}
    >
      {query.isLoading ? (
        <div aria-label="Loading My progress" className="space-y-1.5 px-2 py-1">
          <Skeleton className="h-7 w-full rounded-md bg-sidebar-border/50" />
          <Skeleton className="h-7 w-4/5 rounded-md bg-sidebar-border/40" />
        </div>
      ) : query.isError ? (
        <p role="alert" className="px-3 py-1 text-xs text-destructive">
          My progress unavailable
        </p>
      ) : (
        <div className="space-y-1">
          {status === null ? null : (
            <p role="status" className="px-3 text-xs text-muted-foreground">
              {status}
            </p>
          )}
          {threads.length === 0 ? (
            <p className="px-3 py-1 text-xs text-muted-foreground">
              No participating threads
            </p>
          ) : (
            threads.map((thread) => (
              <MyProgressThreadRow
                key={thread.id}
                activeThreadId={activeThreadId}
                onNavigate={onNavigate}
                thread={thread}
              />
            ))
          )}
          {query.hasNextPage ? (
            <div className="px-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="w-full justify-center text-xs text-muted-foreground"
                disabled={query.isFetchingNextPage}
                onClick={() => query.fetchNextPage()}
              >
                {query.isFetchingNextPage
                  ? "Loading more progress…"
                  : "Load more in My progress"}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </SortableSidebarSection>
  );
}
