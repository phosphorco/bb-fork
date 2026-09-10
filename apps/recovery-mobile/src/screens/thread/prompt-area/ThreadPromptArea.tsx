import type {
  PendingInteraction,
  ThreadQueuedMessage,
  ThreadTimelineActivePromptMode,
  ThreadTimelineGoal,
  ThreadTimelineModelFallback,
  ThreadTimelinePendingTodos,
} from "@bb/domain";
import type {
  ThreadContextWindowUsage,
  ThreadResponse,
  TimelineWorkflowWorkRow,
} from "@bb/server-contract";
import type { RefObject } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Composer, type ComposerAction, type ComposerHandle } from "@/composer";
import type { ChildThreadPendingAttention } from "@/data/interactions";
import { useTheme } from "@/theme";
import { Button, Icon, Text } from "@/ui";
import {
  hasThreadPromptChips,
  ThreadContextWindowIndicator,
  ThreadPromptChips,
} from "../cards/ThreadPromptStackChips";
import type { ThreadContextChipsProps } from "../context/ThreadContextChips";
import { QueuedMessagesList } from "../queue";
import type { FollowUpComposerController } from "./use-follow-up-composer";

interface ThreadPromptAreaProps {
  threadId: string;
  thread: ThreadResponse | undefined;
  /** The environment / host ids the `@` menu searches (from the bootstrap). */
  environmentId: string | null;
  hostId: string | null;
  composer: FollowUpComposerController;
  composerRef: RefObject<ComposerHandle | null>;
  /** The latest pending interaction; replaces the composer while set. */
  pendingInteraction: PendingInteraction | null;
  childPendingInteractions: readonly ChildThreadPendingAttention[];
  queuedMessages: readonly ThreadQueuedMessage[];
  activeWorkflows: readonly TimelineWorkflowWorkRow[];
  activeBackgroundCommands: readonly TimelineWorkflowWorkRow[];
  activePromptMode: ThreadTimelineActivePromptMode | null;
  goal: ThreadTimelineGoal | null;
  pendingTodos: ThreadTimelinePendingTodos | null;
  modelFallback: ThreadTimelineModelFallback | null;
  contextWindowUsage: ThreadContextWindowUsage | undefined;
  contextChips: ThreadContextChipsProps;
}

/** Share of the window the stack + composer may take before the stack scrolls. */
const MAX_PROMPT_AREA_WINDOW_FRACTION = 0.6;
const RECOVERY_DRAFT_ONLY_MODE = {
  kind: "blocked",
  reason: "unavailable",
} as const;

async function retainRecoveryDraft(): Promise<void> {}
const RECOVERY_COMPOSER_ACTIONS: readonly ComposerAction[] = [];

/**
 * The bottom of the thread screen (port of apps/app ThreadDetailPromptArea):
 * either the pending-interaction banner (with the child-thread, plan and
 * goal chips) or the prompt stack — one chip row (workflows, background
 * commands, changed files, pull request, plan, goal, to-dos, model
 * fallback, related and child threads, archive state) and the
 * queued-message list — above the follow-up composer with its execution
 * pills and context-window readout. Archived threads and gone
 * environments keep the stack but hide the composer; so does a thread that
 * is still loading (web parity: the prompt area needs the loaded thread), so
 * nothing is ever typed into a draft keyed on a placeholder project id.
 */
export function ThreadPromptArea({
  threadId,
  thread,
  environmentId,
  hostId,
  composer,
  composerRef,
  pendingInteraction,
  childPendingInteractions,
  queuedMessages,
  activeWorkflows,
  activeBackgroundCommands,
  activePromptMode,
  goal,
  pendingTodos,
  modelFallback,
  contextWindowUsage,
  contextChips,
}: ThreadPromptAreaProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const chipActions = {
    activePromptMode,
    onExitPlanMode: undefined,
    isExitPending: false,
    goal,
    onClearGoal: undefined,
    isClearPending: false,
  };
  const stackChips = {
    workflows: activeWorkflows,
    backgroundCommands: activeBackgroundCommands,
    activePromptMode,
    goal,
    pendingTodos: composer.hidden ? null : pendingTodos,
    context: contextChips,
    childPendingInteractions,
    modelFallback,
  };
  const hasBlockedInteraction = pendingInteraction !== null && !composer.hidden;
  // Skip the stack's bottom gap when nothing renders in it.
  const stackHasContent =
    hasBlockedInteraction ||
    hasThreadPromptChips(stackChips) ||
    (!composer.hidden && queuedMessages.length > 0);
  return (
    <View
      className="bg-background px-3 pt-1"
      style={{
        paddingBottom: Math.max(insets.bottom, 8),
        maxHeight: windowHeight * MAX_PROMPT_AREA_WINDOW_FRACTION,
      }}
      testID="thread-prompt-area"
    >
      <>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ flexGrow: 0, flexShrink: 1 }}
          contentContainerStyle={{
            gap: 8,
            paddingBottom: stackHasContent ? 8 : 0,
          }}
          testID="thread-prompt-stack"
        >
          <ThreadPromptChips {...chipActions} {...stackChips} />
          {hasBlockedInteraction ? (
            <Text variant="caption" className="px-2 text-muted-foreground">
              This thread needs input. Respond from the full BB app.
            </Text>
          ) : null}
          {!composer.hidden && queuedMessages.length > 0 ? (
            <QueuedMessagesList
              threadId={threadId}
              queuedMessages={queuedMessages}
              sendDisabled
              actionDisabled
              editingQueuedMessageId={
                composer.editing?.kind === "queued-message"
                  ? composer.editing.queuedMessageId
                  : null
              }
              savingQueuedMessageId={composer.savingQueuedMessageId}
              onEdit={composer.beginQueuedMessageEdit}
            />
          ) : null}
        </ScrollView>
        {composer.hidden || thread === undefined ? null : (
          <View className="gap-1">
            <Text variant="caption" className="px-2 text-muted-foreground">
              Drafts are saved locally. Guarded delivery is not enabled in this
              slice.
            </Text>
            <Composer
              ref={composerRef}
              value={composer.value}
              onChange={composer.setValue}
              attachments={composer.attachments}
              onAttachmentsChange={composer.setAttachments}
              scope={{
                projectId: thread.projectId,
                threadId,
                environmentId,
                hostId,
                providerId: thread.providerId,
              }}
              submitMode={RECOVERY_DRAFT_ONLY_MODE}
              submitLabel="Guarded send pending"
              onSubmit={retainRecoveryDraft}
              onPromptStack={() => undefined}
              isSubmitting={false}
              placeholder="Write a local draft…"
              actions={RECOVERY_COMPOSER_ACTIONS}
              executionControls={composer.executionControls}
              header={
                composer.editing ? (
                  <EditModeHeader
                    kind={composer.editing.kind}
                    onCancel={composer.cancelEdit}
                  />
                ) : null
              }
              footerAccessory={
                <ThreadContextWindowIndicator usage={contextWindowUsage} />
              }
              typeaheadPlacement="above"
              collapsible
              testID="thread-composer"
            />
          </View>
        )}
      </>
    </View>
  );
}

function EditModeHeader({
  kind,
  onCancel,
}: {
  kind: "queued-message" | "sent-message";
  onCancel: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <View
      className="flex-row items-center gap-2 border-b border-border-hairline px-3 py-1.5"
      testID="thread-composer-edit-header"
    >
      <Icon name="Edit" size={14} color={tokens.mutedForeground} />
      <Text variant="caption" className="min-w-0 flex-1" numberOfLines={1}>
        {kind === "queued-message"
          ? "Editing queued message"
          : "Editing sent message"}
      </Text>
      <Button
        variant="ghost"
        size="sm"
        onPress={onCancel}
        testID="thread-composer-edit-cancel"
      >
        Cancel
      </Button>
    </View>
  );
}
