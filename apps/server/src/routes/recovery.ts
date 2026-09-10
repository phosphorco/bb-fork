import { formatCustomAcpAgentProviderId } from "@bb/config/bb-app-managed-config";
import { getAppSettings, getLatestThreadSequence } from "@bb/db";
import {
  RECOVERY_SNAPSHOT_CONTRACT_VERSION,
  publicApiRoutes,
  typedRoutes,
  type PublicApiSchema,
  type RecoverySnapshotResponse,
  type RecoveryTimelineObservation,
} from "@bb/server-contract";
import type { Context, Hono } from "hono";
import { ApiError } from "../errors.js";
import {
  p6rGetRequestPrincipal,
  p6rPrincipalKeyForActor,
} from "../services/identity.js";
import { requirePublicThread } from "../services/lib/entity-lookup.js";
import { resolveProviderPlanCommand } from "../services/providers/provider-plan-command.js";
import { buildThreadTimelineWithProfile } from "../services/threads/timeline.js";
import {
  DEFAULT_MAX_INLINE_OUTPUT_CHARS,
  truncateTimelineResponseOutputs,
} from "../services/threads/timeline-output-truncation.js";
import { previewTimelineResponseOutputs } from "../services/threads/timeline-output-preview.js";
import type { AppDeps } from "../types.js";
import { buildSidebarBootstrapResponse } from "./projects.js";

function resolveThreadProviderDisplayName(
  deps: Pick<AppDeps, "config" | "providerRegistry">,
  providerId: string,
): string | undefined {
  const customAcpAgent = deps.config.customAcpAgents.find(
    (agent) => formatCustomAcpAgentProviderId(agent.id) === providerId,
  );
  return (
    customAcpAgent?.displayName ??
    deps.providerRegistry.get(providerId)?.info.displayName
  );
}

function buildTimelineObservation(
  deps: AppDeps,
  threadId: string,
  segmentLimit: number,
): RecoveryTimelineObservation {
  const thread = requirePublicThread(deps.db, threadId);
  const headSequence = getLatestThreadSequence(deps.db, { threadId });
  const providerDisplayName = resolveThreadProviderDisplayName(
    deps,
    thread.providerId,
  );
  const includeProviderUnhandledOperations =
    deps.config.isDevelopment ||
    getAppSettings(deps.db).showUnhandledProviderEvents;
  const { response } = buildThreadTimelineWithProfile(deps.db, thread, {
    eventBudget: deps.config.featureFlags.timelineWindowEventBudget,
    includeNestedRows: false,
    includeProviderUnhandledOperations,
    maxInlineOutputChars: DEFAULT_MAX_INLINE_OUTPUT_CHARS,
    maxSeq: headSequence,
    page: { kind: "latest", segmentLimit },
    planCommand: resolveProviderPlanCommand(
      deps.providerRegistry,
      thread.providerId,
    ),
    providerDisplayName,
    summaryOnly: false,
  });
  const timeline = previewTimelineResponseOutputs(
    truncateTimelineResponseOutputs(response, DEFAULT_MAX_INLINE_OUTPUT_CHARS),
  );
  const observedHeadSequence = getLatestThreadSequence(deps.db, { threadId });
  return {
    threadId,
    consistency: observedHeadSequence === headSequence ? "coherent" : "retry",
    headSequence,
    // Pagination cannot prove byte/range completeness: oversized rows and
    // output previews may still omit authoritative data.
    projectionCoverage: "windowed",
    olderCursor: timeline.timelinePage.olderCursor,
    timeline,
  };
}

export function registerRecoveryRoutes(app: Hono, deps: AppDeps): void {
  const { post } = typedRoutes<PublicApiSchema>(app, {
    onValidationError: (message) =>
      new ApiError(400, "invalid_request", message),
  });

  post(publicApiRoutes.recovery.snapshot, (context, request) => {
    const actor = p6rGetRequestPrincipal(context as unknown as Context);
    const timelines: RecoveryTimelineObservation[] = [];
    const unavailableThreads: RecoverySnapshotResponse["unavailableThreads"] =
      [];

    for (const threadId of request.threadIds) {
      try {
        timelines.push(
          buildTimelineObservation(
            deps,
            threadId,
            request.timelineSegmentLimit,
          ),
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          unavailableThreads.push({ threadId, reason: "not-found" });
          continue;
        }
        throw error;
      }
    }

    const threadChanged = timelines.some(
      (timeline) => timeline.consistency === "retry",
    );
    const response: RecoverySnapshotResponse = {
      contractVersion: RECOVERY_SNAPSHOT_CONTRACT_VERSION,
      generatedAtMs: Date.now(),
      consistency: threadChanged ? "retry" : "partial",
      incompleteReasons: [
        "sidebar-revision-unavailable",
        ...(threadChanged ? (["thread-changed-during-snapshot"] as const) : []),
      ],
      cacheOwner:
        actor === null
          ? { state: "read-only", principalKey: null, actor: null }
          : {
              state: "resolved",
              principalKey: p6rPrincipalKeyForActor(actor),
              actor,
            },
      sidebar: buildSidebarBootstrapResponse(deps),
      timelines,
      unavailableThreads,
    };
    return context.json(response);
  });
}
