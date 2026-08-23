import { PERSONAL_PROJECT_ID } from "@bb/domain";
import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { useIsFocused } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useHosts } from "@/data/hosts";
import {
  useSidebarBootstrap,
  buildFacetTriageModel,
  participantDisclosureTarget,
  MY_PROGRESS_SIDEBAR_SECTION_ID,
  shouldRefreshFacetTriage,
  useSidebarCollapsedSets,
  useSidebarModel,
  useMyProgressFacetQuery,
  useSidebarPreferences,
  useSidebarSectionOrder,
  type FacetParticipantDisclosureTarget,
} from "@/data/sidebar";
import { Button, EmptyStatePanel, Skeleton, Text, useSheet } from "@/ui";
import { useSidebarActions } from "./SidebarActionsProvider";
import {
  SidebarEmptyRowView,
  SidebarEnvironmentRowView,
  SidebarHeaderRowView,
  SidebarThreadRowView,
} from "./SidebarRows";
import {
  FacetParticipantDisclosureSheet,
  FacetTriageContinuationRowView,
  FacetTriageHeaderRowView,
  FacetTriageMessageRowView,
  FacetTriageThreadRowView,
} from "./FacetTriageRows";
import {
  buildFacetTriageRows,
  type FacetTriageListRow,
  type FacetTriageThreadRow,
} from "@/data/sidebar/facet-triage-rows-model";
import {
  buildSidebarSectionRows,
  getHeaderCollapseTarget,
  type SidebarHeaderRow,
  type SidebarListRow,
  type SidebarThreadRow,
} from "./sidebar-list-rows";

type MobileSidebarListRow = SidebarListRow | FacetTriageListRow;

/**
 * FlashList keeps the first visible row anchored when rows are inserted above
 * it (chat-style). A sidebar wants the opposite: a thread that gets pinned or
 * created must appear at the top, not push the viewport down past it.
 */
const DISABLE_MAINTAIN_POSITION = { disabled: true };

const SKELETON_WIDTHS = ["w-1/2", "w-2/3", "w-3/5", "w-1/2", "w-3/4", "w-2/5"];

function SidebarListSkeleton() {
  return (
    <View className="gap-3 px-4 pt-4" testID="sidebar-list-loading">
      <Skeleton className="h-3 w-24" />
      {SKELETON_WIDTHS.map((width, index) => (
        <View key={index} className="flex-row items-center gap-3 py-1">
          <Skeleton className={`h-4 ${width}`} />
          <View className="flex-1" />
          <Skeleton className="h-3 w-8" />
        </View>
      ))}
    </View>
  );
}

interface SidebarThreadListProps {
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The grouped thread list (pinned, then projects / machines / sections per
 * the organize preference) as a FlashList, the body of the home screen; the
 * row menus come from the enclosing `SidebarActionsProvider`.
 * Data stays put across realtime refetches (the bootstrap query keeps its
 * previous data), so rows update in place instead of flashing.
 */
export function SidebarThreadList({
  contentContainerStyle,
  testID,
}: SidebarThreadListProps) {
  const [preferences, preferenceActions] = useSidebarPreferences();
  const collapsed = useSidebarCollapsedSets(preferences);
  const facetTriageCollapsed = collapsed.facetTriageIds.has(
    MY_PROGRESS_SIDEBAR_SECTION_ID,
  );
  const facetQuery = useMyProgressFacetQuery(!facetTriageCollapsed);
  const isScreenFocused = useIsFocused();
  const { model, isLoading, isError, error, refetch } = useSidebarModel({
    organize: preferences.organize,
    sort: preferences.sort,
  });
  const bootstrap = useSidebarBootstrap();
  const hosts = useHosts();
  const actions = useSidebarActions();
  const [refreshing, setRefreshing] = useState(false);
  const participantSheet = useSheet();
  const [participantSelection, setParticipantSelection] =
    useState<FacetParticipantDisclosureTarget | null>(null);

  const sectionOrder = useSidebarSectionOrder(
    model,
    preferences,
    preferenceActions,
  );
  const facetModel = useMemo(
    () => buildFacetTriageModel(facetQuery.data?.pages ?? []),
    [facetQuery.data],
  );
  const facetRows = useMemo(
    () =>
      buildFacetTriageRows({
        collapsed: facetTriageCollapsed,
        hasNextPage: facetQuery.hasNextPage,
        isError: facetQuery.isError,
        isFetchingNextPage: facetQuery.isFetchingNextPage,
        isLoading: facetQuery.isLoading,
        model: facetModel,
      }),
    [
      facetModel,
      facetQuery.hasNextPage,
      facetQuery.isError,
      facetQuery.isFetchingNextPage,
      facetQuery.isLoading,
      facetTriageCollapsed,
    ],
  );
  const rows = useMemo<MobileSidebarListRow[]>(
    () =>
      sectionOrder.flatMap<MobileSidebarListRow>((sectionId) =>
        sectionId === MY_PROGRESS_SIDEBAR_SECTION_ID
          ? facetRows
          : buildSidebarSectionRows({
              model,
              collapsed,
              sectionId,
            }),
      ),
    [collapsed, facetRows, model, sectionOrder],
  );

  const visibilityRef = useRef({
    collapsed: facetTriageCollapsed,
    screenFocused: isScreenFocused,
  });
  const facetRefetch = facetQuery.refetch;
  useEffect(() => {
    const next = {
      collapsed: facetTriageCollapsed,
      screenFocused: isScreenFocused,
    };
    if (
      shouldRefreshFacetTriage({
        hasData: facetQuery.data !== undefined,
        previous: visibilityRef.current,
        next,
      })
    ) {
      void facetRefetch();
    }
    visibilityRef.current = next;
  }, [facetQuery.data, facetRefetch, facetTriageCollapsed, isScreenFocused]);

  const bootstrapRefetch = bootstrap.refetch;
  const hostsRefetch = hosts.refetch;
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.allSettled([
      bootstrapRefetch(),
      hostsRefetch(),
      ...(!facetTriageCollapsed ? [facetRefetch()] : []),
    ]).finally(() => setRefreshing(false));
  }, [bootstrapRefetch, facetRefetch, facetTriageCollapsed, hostsRefetch]);

  const onThreadPress = useCallback(
    (row: SidebarThreadRow) => actions.openThread(row.thread),
    [actions],
  );
  const onThreadLongPress = useCallback(
    (row: SidebarThreadRow) => actions.openThreadMenu(row.thread),
    [actions],
  );
  const onToggleThread = useCallback(
    (threadId: string) => preferenceActions.toggleCollapsed("thread", threadId),
    [preferenceActions],
  );
  const onToggleEnvironment = useCallback(
    (environmentId: string) =>
      preferenceActions.toggleCollapsed("environment", environmentId),
    [preferenceActions],
  );
  const onToggleHeader = useCallback(
    (row: SidebarHeaderRow) => {
      const target = getHeaderCollapseTarget(row);
      preferenceActions.toggleCollapsed(target.kind, target.id);
    },
    [preferenceActions],
  );
  const onHeaderLongPress = useCallback(
    (row: SidebarHeaderRow) => {
      switch (row.target.kind) {
        case "project":
          actions.openProjectMenu(row.target.project);
          return;
        case "section":
          actions.openSectionMenu(row.target.section);
          return;
        case "pinned":
        case "threads":
        case "machine":
          // No menu of their own: a long-press goes straight to reordering.
          actions.openSectionReorder();
          return;
      }
    },
    [actions],
  );
  const onHeaderCreateThread = useCallback(
    (row: SidebarHeaderRow) => {
      switch (row.target.kind) {
        case "project":
          actions.createThread({ projectId: row.target.project.id });
          return;
        case "section":
          actions.createThread({ sectionId: row.target.section.id });
          return;
        case "threads":
          actions.createThread({ projectId: PERSONAL_PROJECT_ID });
          return;
        case "pinned":
        case "machine":
          return;
      }
    },
    [actions],
  );

  const onToggleFacetTriage = useCallback(
    () =>
      preferenceActions.toggleCollapsed(
        "facetTriage",
        MY_PROGRESS_SIDEBAR_SECTION_ID,
      ),
    [preferenceActions],
  );
  const onFacetThreadPress = useCallback(
    (row: FacetTriageThreadRow) => actions.openThread(row.thread),
    [actions],
  );
  const onFacetThreadLongPress = useCallback(
    (row: FacetTriageThreadRow) => actions.openThreadMenu(row.thread),
    [actions],
  );
  const onShowParticipantOverflow = useCallback(
    (row: FacetTriageThreadRow) => {
      setParticipantSelection(participantDisclosureTarget(row.thread));
      participantSheet.present();
    },
    [participantSheet],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<MobileSidebarListRow>) => {
      switch (item.type) {
        case "facet-triage-header":
          return (
            <FacetTriageHeaderRowView
              row={item}
              onPress={onToggleFacetTriage}
              onLongPress={actions.openSectionReorder}
            />
          );
        case "facet-triage-thread":
          return (
            <FacetTriageThreadRowView
              row={item}
              onPress={onFacetThreadPress}
              onLongPress={onFacetThreadLongPress}
              onShowOverflow={onShowParticipantOverflow}
            />
          );
        case "facet-triage-message":
          return (
            <FacetTriageMessageRowView
              row={item}
              onRetry={() => void facetRefetch()}
            />
          );
        case "facet-triage-continuation":
          return (
            <FacetTriageContinuationRowView
              row={item}
              onLoadMore={() => void facetQuery.fetchNextPage()}
            />
          );
        case "header":
          return (
            <SidebarHeaderRowView
              row={item}
              onToggleCollapsed={onToggleHeader}
              onLongPress={onHeaderLongPress}
              onCreateThread={
                item.target.kind === "pinned" || item.target.kind === "machine"
                  ? null
                  : onHeaderCreateThread
              }
            />
          );
        case "thread":
          // One line per row, like the web sidebar: the project name lives
          // on the group header, not under every thread.
          return (
            <SidebarThreadRowView
              row={item}
              subtitle={null}
              onPress={onThreadPress}
              onLongPress={onThreadLongPress}
              onToggleCollapsed={onToggleThread}
            />
          );
        case "environment":
          return (
            <SidebarEnvironmentRowView
              row={item}
              onToggleCollapsed={onToggleEnvironment}
            />
          );
        case "empty":
          return <SidebarEmptyRowView row={item} />;
      }
    },
    [
      onHeaderCreateThread,
      onHeaderLongPress,
      onThreadLongPress,
      onThreadPress,
      onToggleEnvironment,
      onToggleHeader,
      onToggleThread,
      actions.openSectionReorder,
      facetQuery,
      facetRefetch,
      onFacetThreadLongPress,
      onFacetThreadPress,
      onShowParticipantOverflow,
      onToggleFacetTriage,
    ],
  );

  const isEmpty =
    model.isReady && model.projects.length === 0 && model.threads.length === 0;
  const legacyFooter = !model.isReady ? (
    isError ? (
      <View className="gap-3 p-4" testID="sidebar-list-error">
        <EmptyStatePanel>
          <Text className="text-center text-sm text-muted-foreground">
            Could not load threads.
          </Text>
          <Text
            variant="caption"
            className="pt-1 text-center"
            numberOfLines={3}
          >
            {error?.message ?? "Unknown error"}
          </Text>
        </EmptyStatePanel>
        <Button variant="outline" icon="RotateCcw" onPress={refetch}>
          Retry
        </Button>
      </View>
    ) : isLoading ? (
      <SidebarListSkeleton />
    ) : null
  ) : isEmpty ? (
    <View className="gap-3 px-4 pt-6" testID="sidebar-list-empty">
      <EmptyStatePanel>
        No projects yet. Add a project to start threads on a machine, or start a
        personal thread.
      </EmptyStatePanel>
      <Button icon="FolderPlus" onPress={actions.createProject}>
        New project
      </Button>
      <Button
        variant="outline"
        icon="MessageSquarePlus"
        onPress={() => actions.createThread({ projectId: PERSONAL_PROJECT_ID })}
      >
        New thread
      </Button>
    </View>
  ) : null;

  return (
    <>
      <FlashList
        data={rows}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        renderItem={renderItem}
        maintainVisibleContentPosition={DISABLE_MAINTAIN_POSITION}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListFooterComponent={legacyFooter}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
        testID={testID}
      />
      <FacetParticipantDisclosureSheet
        controller={participantSheet}
        selection={participantSelection}
        onDismiss={() => setParticipantSelection(null)}
      />
    </>
  );
}

function keyExtractor(row: MobileSidebarListRow): string {
  return row.key;
}

function getItemType(row: MobileSidebarListRow): string {
  return row.type;
}
