import { Image } from "expo-image";
import { memo, useMemo, useState } from "react";
import { Pressable, View, type GestureResponderEvent } from "react-native";
import {
  participantAvatarItems,
  participantGroupLabel,
  participantOverflowCount,
  activateFacetRowNestedControl,
  type FacetParticipantDisclosureTarget,
} from "@/data/sidebar/facet-triage-model";
import type {
  FacetTriageContinuationRow,
  FacetTriageHeaderRow,
  FacetTriageMessageRow,
  FacetTriageThreadRow,
} from "@/data/sidebar/facet-triage-rows-model";
import { useFacetParticipantPages } from "@/data/sidebar/use-facet-triage-query";
import { getThreadDisplayTitle } from "@/data/threads";
import { useTheme } from "@/theme";
import { Button, Icon, Sheet, Spinner, Text, type SheetController } from "@/ui";
import { flatThreadRow } from "./sidebar-list-rows";
import { ThreadStatusGlyph } from "./ThreadStatusGlyph";

const ROW_MIN_HEIGHT = 48;
const ROW_PADDING_LEFT = 16;
const ROW_PADDING_RIGHT = 8;

export const FacetTriageHeaderRowView = memo(function FacetTriageHeaderRowView({
  row,
  onPress,
  onLongPress,
}: {
  row: FacetTriageHeaderRow;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="My progress"
      accessibilityState={{ expanded: !row.collapsed }}
      onPress={onPress}
      onLongPress={onLongPress}
      className="mt-1.5 flex-row items-center gap-1 px-4 active:bg-state-hover"
      style={{ minHeight: 36 }}
      testID="facet-triage-my-progress-header"
    >
      <Icon name="ListView" size={14} color={tokens.subtleForeground} />
      <Text variant="sectionLabel" numberOfLines={1} className="min-w-0 shrink">
        My progress
      </Text>
      <View className="h-6 w-6 items-center justify-center">
        <Icon
          name={row.collapsed ? "ChevronRight" : "ChevronDown"}
          size={12}
          color={tokens.subtleForeground}
        />
      </View>
      <View className="flex-1" />
      {row.collapsed && row.threadCount !== null && row.threadCount > 0 ? (
        <View className="rounded-sm bg-surface-selected px-1.5 py-px">
          <Text variant="chrome">{row.threadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
});

function FacetParticipantAvatarGroup({
  row,
  onShowOverflow,
}: {
  row: FacetTriageThreadRow;
  onShowOverflow: (row: FacetTriageThreadRow) => void;
}) {
  const [revealedName, setRevealedName] = useState<string | null>(null);
  const summary = row.thread.participantSummary;
  const items = participantAvatarItems(summary.profiles);
  const overflow = participantOverflowCount(summary);
  if (summary.totalCount === 0 || items.length === 0) return null;

  const nestedPress = (event: GestureResponderEvent, disclose: () => void) => {
    activateFacetRowNestedControl(event, disclose);
  };

  return (
    <View className="items-end" testID={`facet-participants-${row.thread.id}`}>
      <Text
        accessibilityRole="summary"
        accessibilityLabel={participantGroupLabel(summary)}
        className="sr-only"
      >
        {participantGroupLabel(summary)}
      </Text>
      <View className="flex-row items-center gap-0.5">
        {items.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityHint="Reveals participant name"
            onPress={(event) =>
              nestedPress(event, () => setRevealedName(item.label))
            }
            className="h-7 w-7 items-center justify-center rounded-full bg-surface-recessed active:opacity-70"
            testID={`facet-participant-${row.thread.id}-${item.key}`}
          >
            {item.imageUrl === null ? (
              <Text variant="chrome" accessibilityElementsHidden>
                {item.initials}
              </Text>
            ) : (
              <Image
                source={{ uri: item.imageUrl }}
                accessibilityLabel={item.label}
                style={{ width: 28, height: 28, borderRadius: 14 }}
                contentFit="cover"
              />
            )}
          </Pressable>
        ))}
        {overflow > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${overflow} more participants`}
            accessibilityHint="Opens participant list"
            onPress={(event) => nestedPress(event, () => onShowOverflow(row))}
            className="h-7 min-w-7 items-center justify-center rounded-full bg-surface-recessed px-1 active:opacity-70"
            testID={`facet-participant-overflow-${row.thread.id}`}
          >
            <Text variant="chrome">+{overflow}</Text>
          </Pressable>
        ) : null}
      </View>
      {revealedName === null ? null : (
        <Text
          variant="caption"
          numberOfLines={1}
          accessibilityLiveRegion="polite"
          testID={`facet-participant-name-${row.thread.id}`}
        >
          {revealedName}
        </Text>
      )}
    </View>
  );
}

export const FacetTriageThreadRowView = memo(function FacetTriageThreadRowView({
  row,
  onPress,
  onLongPress,
  onShowOverflow,
}: {
  row: FacetTriageThreadRow;
  onPress: (row: FacetTriageThreadRow) => void;
  onLongPress: (row: FacetTriageThreadRow) => void;
  onShowOverflow: (row: FacetTriageThreadRow) => void;
}) {
  const title = getThreadDisplayTitle(row.thread);
  const indicator = flatThreadRow(row.thread).indicator;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => onPress(row)}
      onLongPress={() => onLongPress(row)}
      className="flex-row items-center gap-2 active:bg-state-hover"
      style={{
        minHeight: ROW_MIN_HEIGHT,
        paddingLeft: ROW_PADDING_LEFT,
        paddingRight: ROW_PADDING_RIGHT,
      }}
      testID={`facet-triage-thread-${row.thread.id}`}
    >
      <Text
        variant="body"
        numberOfLines={1}
        className="min-w-0 flex-1 text-foreground/90"
      >
        {title}
      </Text>
      <FacetParticipantAvatarGroup row={row} onShowOverflow={onShowOverflow} />
      <View className="h-9 w-9 items-center justify-center">
        <ThreadStatusGlyph kind={indicator} />
      </View>
    </Pressable>
  );
});

export function FacetTriageMessageRowView({
  row,
  onRetry,
}: {
  row: FacetTriageMessageRow;
  onRetry: () => void;
}) {
  return (
    <View
      accessibilityRole={row.kind === "error" ? "alert" : "text"}
      className="min-h-11 flex-row items-center gap-2 px-4 py-2"
      testID={`facet-triage-${row.kind}`}
    >
      {row.kind === "loading" ? <Spinner size="small" /> : null}
      <Text variant="caption" className="min-w-0 flex-1">
        {row.label}
      </Text>
      {row.retry ? (
        <Button size="sm" variant="outline" onPress={onRetry}>
          Retry
        </Button>
      ) : null}
    </View>
  );
}

export function FacetTriageContinuationRowView({
  row,
  onLoadMore,
}: {
  row: FacetTriageContinuationRow;
  onLoadMore: () => void;
}) {
  return (
    <View className="px-4 py-2">
      <Button
        size="sm"
        variant="outline"
        disabled={row.loading}
        onPress={onLoadMore}
        testID="facet-triage-load-more"
      >
        {row.loading ? "Loading threads…" : "Load more threads"}
      </Button>
    </View>
  );
}

export function FacetParticipantDisclosureSheet({
  controller,
  selection,
  onDismiss,
}: {
  controller: SheetController;
  selection: FacetParticipantDisclosureTarget | null;
  onDismiss: () => void;
}) {
  const query = useFacetParticipantPages({
    enabled: selection !== null,
    initialCursor: selection?.initialCursor ?? null,
    threadId: selection?.threadId ?? "",
  });
  const participants = useMemo(
    () => query.data?.pages.flatMap((page) => page.profiles) ?? [],
    [query.data],
  );
  return (
    <Sheet
      controller={controller}
      title="More participants"
      layout="scroll"
      onDismiss={onDismiss}
      deferContent={false}
    >
      <View className="gap-2 px-4 py-3" testID="facet-participant-disclosure">
        {selection === null ? null : (
          <Text variant="caption">
            {selection.remainingCount} more participants
          </Text>
        )}
        {selection?.initialCursor === null ? (
          <Text variant="caption" accessibilityRole="alert">
            Participants unavailable
          </Text>
        ) : query.isLoading ? (
          <View className="flex-row items-center gap-2">
            <Spinner size="small" />
            <Text variant="caption">Loading participants…</Text>
          </View>
        ) : query.isError ? (
          <Text variant="caption" accessibilityRole="alert">
            Participants unavailable
          </Text>
        ) : (
          participants.map((participant) => (
            <Text
              key={participant.p6rPrincipalKey}
              variant="body"
              accessibilityLabel={participant.p6rDisplayName}
              testID={`facet-disclosure-participant-${participant.p6rPrincipalKey}`}
            >
              {participant.p6rDisplayName}
            </Text>
          ))
        )}
        {query.hasNextPage ? (
          <Button
            size="sm"
            variant="outline"
            disabled={query.isFetchingNextPage}
            onPress={() => void query.fetchNextPage()}
            testID="facet-participants-load-more"
          >
            {query.isFetchingNextPage
              ? "Loading participants…"
              : "Load more participants"}
          </Button>
        ) : null}
      </View>
    </Sheet>
  );
}
