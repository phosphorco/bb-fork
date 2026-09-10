import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  ensureCoreParticipantsProjection,
  getOrCreateThreadFacetCursorSigningKey,
  getThreadSectionById,
  listLastStoredTurnRequestEventsByThreadIds,
  listCoreParticipantProfilePage,
  listProjectExecutionDefaultsByProjectIds,
  listThreadFacetOwnerProjections,
  listThreadExecutionOverridesByThreadIds,
  listThreadExecutionProjectionRowsByIds,
  listThreadIdsForFacetProjection,
  listThreadsWithPendingInteractionStateByIds,
  queryThreadFacetThreadIds,
  ThreadFacetInvariantError,
  type DbConnection,
  type DbQueryConnection,
  type ThreadFacetQueryPosition,
} from "@bb/db";
import {
  p6rPrincipalKeyForActorSnapshot,
  providerModelCatalogDependsOnWorkspace,
  type P6rActorSnapshot,
  type ResolvedThreadFacetFilter,
  type ThreadFacetFilter,
  type ThreadFacetQueryRequest,
  type ThreadFacetTypeId,
  type ReasoningLevel,
} from "@bb/domain";
import type {
  ExperimentalThreadExecutionSummary,
  ThreadFacetParticipantsResponse,
  ThreadFacetQueryResponse,
} from "@bb/server-contract";
import { z } from "zod";
import { ApiError } from "../../errors.js";
import {
  requirePublicProject,
  requirePublicThread,
} from "../lib/entity-lookup.js";
import type { AppDeps } from "../../types.js";
import { toThreadListEntryResponses } from "./thread-runtime-display.js";
import { DEFAULT_REASONING_LEVEL } from "./thread-default-policy.js";
import { parseStoredTurnRequestEvent } from "./thread-events.js";

const THREAD_FACET_QUERY_REQUEST_MAX_BYTES = 16 * 1024;
const THREAD_FACET_CURSOR_MAX_BYTES = 4 * 1024;

const threadFacetQueryPositionSchema = z
  .object({
    threadId: z.string().min(1),
    updatedAt: z.number().int().nonnegative().nullable(),
    state: z.number().int().nonnegative().nullable(),
    rank: z.number().int().nonnegative().nullable(),
  })
  .strict();

const queryCursorSchema = z
  .object({
    version: z.literal(1),
    digest: z.string().length(64),
    position: threadFacetQueryPositionSchema,
  })
  .strict();

const participantCursorSchema = z
  .object({
    version: z.literal(1),
    digest: z.string().length(64),
    position: z.number().int().nonnegative(),
  })
  .strict();

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function cursorEncode(value: object, signingKey: string): string {
  const payload = Buffer.from(JSON.stringify(value), "utf8").toString(
    "base64url",
  );
  const signature = createHmac("sha256", Buffer.from(signingKey, "hex"))
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function cursorDecode(cursor: string, signingKey: string): unknown {
  if (Buffer.byteLength(cursor, "utf8") > THREAD_FACET_CURSOR_MAX_BYTES) {
    throw new ApiError(400, "invalid_cursor", "Cursor is too large");
  }
  try {
    const [payload, suppliedSignature, extra] = cursor.split(".");
    if (!payload || !suppliedSignature || extra !== undefined) {
      throw new Error("invalid cursor envelope");
    }
    const expectedSignature = createHmac(
      "sha256",
      Buffer.from(signingKey, "hex"),
    )
      .update(payload)
      .digest();
    const suppliedSignatureBytes = Buffer.from(suppliedSignature, "base64url");
    if (
      suppliedSignatureBytes.byteLength !== expectedSignature.byteLength ||
      !timingSafeEqual(suppliedSignatureBytes, expectedSignature)
    ) {
      throw new Error("invalid cursor signature");
    }
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new ApiError(400, "invalid_cursor", "Cursor is malformed");
  }
}

function requestPrincipalKey(actor: P6rActorSnapshot | null): string {
  return actor === null ? "anonymous" : p6rPrincipalKeyForActorSnapshot(actor);
}

function resolveFilters(
  filters: readonly ThreadFacetFilter[],
  actor: P6rActorSnapshot | null,
): ResolvedThreadFacetFilter[] {
  return filters.map((filter) => {
    if (filter.operator === "present" || filter.operator === "absent") {
      return filter;
    }
    if (typeof filter.member === "string") {
      return { ...filter, member: filter.member };
    }
    if (actor === null) {
      throw new ApiError(
        401,
        "authentication_required",
        "The request-principal perspective requires authentication",
      );
    }
    return {
      typeId: filter.typeId,
      operator: filter.operator,
      member: p6rPrincipalKeyForActorSnapshot(actor),
    };
  });
}

function mapFacetInvariant(error: unknown): never {
  if (!(error instanceof ThreadFacetInvariantError)) {
    throw error;
  }
  if (error.code === "facet_unavailable") {
    throw new ApiError(
      400,
      "facet_unavailable",
      "The requested facet type is unavailable",
    );
  }
  throw new ApiError(400, "invalid_request", "The facet query is invalid");
}

function namedTypeIds(args: {
  filters: readonly ResolvedThreadFacetFilter[];
  order: ThreadFacetQueryRequest["order"];
}): ThreadFacetTypeId[] {
  return [
    ...args.filters.map(({ typeId }) => typeId),
    ...(args.order ? [args.order.typeId] : []),
  ];
}

function canonicalFilters(
  filters: readonly ResolvedThreadFacetFilter[],
): ResolvedThreadFacetFilter[] {
  return [...filters].sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right)),
  );
}

function queryDigest(args: {
  completeness: string;
  filters: readonly ResolvedThreadFacetFilter[];
  order: ThreadFacetQueryRequest["order"];
  pageSize: number;
  principalKey: string;
  scope: ThreadFacetQueryRequest["scope"];
  includeExecution: boolean;
}): string {
  return digest(
    JSON.stringify({
      principalKey: args.principalKey,
      scope: args.scope,
      filters: args.filters,
      order: args.order ?? null,
      pageSize: args.pageSize,
      completeness: args.completeness,
      includeExecution: args.includeExecution,
    }),
  );
}

interface ThreadExecutionProjectionInput {
  environmentId: string | null;
  environmentUpdatedAt: number | null;
  executionRevision: number;
  hostId: string | null;
  id: string;
  path: string | null;
  projectId: string;
  providerId: string;
}

export interface ThreadExecutionProjectionDetails {
  /** Model that becomes effective after clearing a sticky model override. */
  fallbackModel: string | null;
  /** Reasoning that becomes effective after clearing its sticky override. */
  fallbackReasoningLevel: ReasoningLevel | null;
  summary: ExperimentalThreadExecutionSummary;
}

export function buildThreadExecutionProjectionDetails(
  deps: { db: DbQueryConnection },
  threads: readonly ThreadExecutionProjectionInput[],
): Map<string, ThreadExecutionProjectionDetails> {
  const details = new Map<string, ThreadExecutionProjectionDetails>();
  const threadIds = threads.map(({ id }) => id);
  const overrides = listThreadExecutionOverridesByThreadIds(deps.db, threadIds);
  const projectDefaults = listProjectExecutionDefaultsByProjectIds(deps.db, {
    projectIds: threads.map(({ projectId }) => projectId),
  });
  const lastRows = new Map(
    listLastStoredTurnRequestEventsByThreadIds(deps.db, { threadIds }).map(
      (row) => [row.threadId, row],
    ),
  );

  for (const thread of threads) {
    const override = overrides.get(thread.id) ?? {
      executionRevision: thread.executionRevision,
      modelOverride: null,
      reasoningLevelOverride: null,
    };
    const projectDefault = projectDefaults.get(thread.projectId);
    const matchingProjectDefault =
      projectDefault?.providerId === thread.providerId ? projectDefault : null;
    const lastRow = lastRows.get(thread.id);
    let malformedHistory = false;
    let lastExecution:
      | ReturnType<typeof parseStoredTurnRequestEvent>["execution"]
      | null = null;
    if (lastRow !== undefined) {
      try {
        lastExecution = parseStoredTurnRequestEvent(lastRow).execution;
      } catch {
        malformedHistory = true;
      }
    }

    const modelResolution = override.modelOverride
      ? { model: override.modelOverride, source: "thread-override" as const }
      : lastExecution?.model
        ? { model: lastExecution.model, source: "last-turn" as const }
        : matchingProjectDefault?.model
          ? {
              model: matchingProjectDefault.model,
              source: "project-default" as const,
            }
          : null;
    const effectiveReasoningLevel: ReasoningLevel =
      override.reasoningLevelOverride ??
      lastExecution?.reasoningLevel ??
      matchingProjectDefault?.reasoningLevel ??
      DEFAULT_REASONING_LEVEL;
    const reasoningSource =
      override.reasoningLevelOverride !== null
        ? "thread-override"
        : lastExecution?.reasoningLevel
          ? "last-turn"
          : matchingProjectDefault?.reasoningLevel
            ? "project-default"
            : "builtin-default";
    const witness = digest(
      JSON.stringify({
        executionRevision: override.executionRevision,
        environmentId: thread.environmentId,
        environmentUpdatedAt: thread.environmentUpdatedAt,
        hostId: thread.hostId,
        workspacePath: thread.path,
        providerId: thread.providerId,
        modelOverride: override.modelOverride,
        reasoningLevelOverride: override.reasoningLevelOverride,
        latestRequestSequence: lastRow?.sequence ?? null,
        lastExecution: malformedHistory ? "malformed" : lastExecution,
        projectDefault: matchingProjectDefault,
      }),
    );
    const base = {
      providerId: thread.providerId,
      catalogDependsOnWorkspace: providerModelCatalogDependsOnWorkspace(
        thread.providerId,
      ),
      projectId: thread.projectId,
      environmentId: thread.environmentId,
      hostId: thread.hostId,
      workspacePath: thread.path,
      effectiveReasoningLevel,
      modelOverride: override.modelOverride,
      reasoningLevelOverride: override.reasoningLevelOverride,
      reasoningSource,
      latestRequestSequence: lastRow?.sequence ?? null,
      witness,
    } as const;
    const summary: ExperimentalThreadExecutionSummary = malformedHistory
      ? {
          ...base,
          state: "unresolved",
          effectiveModel: null,
          modelSource: "unresolved",
          issue: "malformed-history",
        }
      : modelResolution === null
        ? {
            ...base,
            state: "unresolved",
            effectiveModel: null,
            modelSource: "unresolved",
            issue: "missing-model",
          }
        : {
            ...base,
            state: "resolved",
            effectiveModel: modelResolution.model,
            modelSource: modelResolution.source,
          };
    details.set(thread.id, {
      fallbackModel: malformedHistory
        ? null
        : (lastExecution?.model ?? matchingProjectDefault?.model ?? null),
      fallbackReasoningLevel: malformedHistory
        ? null
        : (lastExecution?.reasoningLevel ??
          matchingProjectDefault?.reasoningLevel ??
          DEFAULT_REASONING_LEVEL),
      summary,
    });
  }
  return details;
}

export function buildThreadExecutionProjection(
  deps: { db: DbQueryConnection },
  threads: readonly ThreadExecutionProjectionInput[],
): Map<string, ExperimentalThreadExecutionSummary> {
  return new Map(
    [...buildThreadExecutionProjectionDetails(deps, threads)].map(
      ([threadId, details]) => [threadId, details.summary],
    ),
  );
}

function decodeQueryCursor(
  cursor: string | undefined,
  expectedDigest: string,
  signingKey: string,
): ThreadFacetQueryPosition | undefined {
  if (cursor === undefined) {
    return undefined;
  }
  const parsed = queryCursorSchema.safeParse(cursorDecode(cursor, signingKey));
  if (!parsed.success || parsed.data.digest !== expectedDigest) {
    throw new ApiError(
      400,
      "invalid_cursor",
      "Cursor does not match this facet query",
    );
  }
  return parsed.data.position;
}

function participantDigest(args: {
  principalKey: string;
  threadId: string;
}): string {
  return digest(JSON.stringify(args));
}

function encodeParticipantCursor(args: {
  digest: string;
  position: number | null;
  signingKey: string;
}): string | null {
  return args.position === null
    ? null
    : cursorEncode(
        {
          version: 1,
          digest: args.digest,
          position: args.position,
        },
        args.signingKey,
      );
}

function decodeParticipantCursor(args: {
  cursor: string | undefined;
  digest: string;
  signingKey: string;
}): number | undefined {
  if (args.cursor === undefined) {
    return undefined;
  }
  const parsed = participantCursorSchema.safeParse(
    cursorDecode(args.cursor, args.signingKey),
  );
  if (!parsed.success || parsed.data.digest !== args.digest) {
    throw new ApiError(
      400,
      "invalid_cursor",
      "Cursor does not match this participant list",
    );
  }
  return parsed.data.position;
}

function ensureProjectionForScope(
  db: DbConnection,
  scope: ThreadFacetQueryRequest["scope"],
): void {
  ensureCoreParticipantsProjection(
    db,
    listThreadIdsForFacetProjection(db, {
      ...scope,
      includeHidden: scope.includeHidden ?? false,
    }),
  );
}

export function executeThreadFacetQuery(
  deps: AppDeps,
  args: {
    actor: P6rActorSnapshot | null;
    request: ThreadFacetQueryRequest;
  },
): ThreadFacetQueryResponse {
  if (
    Buffer.byteLength(JSON.stringify(args.request), "utf8") >
    THREAD_FACET_QUERY_REQUEST_MAX_BYTES
  ) {
    throw new ApiError(400, "invalid_request", "Facet query is too large");
  }
  const filters = canonicalFilters(
    resolveFilters(args.request.filters, args.actor),
  );
  if (args.request.scope.projectId !== undefined) {
    requirePublicProject(deps.db, args.request.scope.projectId);
  }
  if (
    args.request.scope.sectionId !== undefined &&
    args.request.scope.unsectioned === true
  ) {
    throw new ApiError(
      400,
      "invalid_request",
      "sectionId and unsectioned cannot be used together",
    );
  }
  if (
    args.request.scope.sectionId !== undefined &&
    !getThreadSectionById(deps.db, args.request.scope.sectionId)
  ) {
    throw new ApiError(404, "section_not_found", "Section not found");
  }
  ensureProjectionForScope(deps.db, args.request.scope);
  try {
    const signingKey = getOrCreateThreadFacetCursorSigningKey(deps.db);
    const typeIds = namedTypeIds({ filters, order: args.request.order });
    const ownerProjections = listThreadFacetOwnerProjections(deps.db, typeIds);
    const completeness = [...ownerProjections]
      .sort((left, right) => left.typeId.localeCompare(right.typeId))
      .map(
        ({ generation, ownerState, projectionRevision, typeId }) =>
          `${typeId}:${generation}:${ownerState}:${projectionRevision}`,
      )
      .join("|");
    const expectedDigest = queryDigest({
      principalKey: requestPrincipalKey(args.actor),
      scope: args.request.scope,
      filters,
      order: args.request.order,
      pageSize: args.request.pageSize,
      completeness,
      includeExecution: args.request.experimental_includeExecution ?? false,
    });
    const after = decodeQueryCursor(
      args.request.cursor,
      expectedDigest,
      signingKey,
    );
    const page = queryThreadFacetThreadIds(deps.db, {
      ...args.request.scope,
      filters,
      includeHidden: args.request.scope.includeHidden ?? false,
      pageSize: args.request.pageSize,
      ...(args.request.order ? { order: args.request.order } : {}),
      ...(after === undefined ? {} : { after }),
    });
    const hydratedById = new Map(
      listThreadsWithPendingInteractionStateByIds(deps.db, page.threadIds).map(
        (thread) => [thread.id, thread],
      ),
    );
    const orderedThreads = page.threadIds.flatMap((threadId) => {
      const thread = hydratedById.get(threadId);
      return thread ? [thread] : [];
    });
    const entries = toThreadListEntryResponses(deps, {
      threads: orderedThreads,
      includeParticipants: false,
    });
    const executionByThreadId = args.request.experimental_includeExecution
      ? buildThreadExecutionProjection(
          deps,
          listThreadExecutionProjectionRowsByIds(
            deps.db,
            orderedThreads.map(({ id }) => id),
          ).map((row) => ({ ...row, id: row.threadId })),
        )
      : null;
    const principal = requestPrincipalKey(args.actor);
    const threads = entries.map((thread) => {
      const participantPage = listCoreParticipantProfilePage(deps.db, {
        threadId: thread.id,
        pageSize: 3,
      });
      const participantCursorDigest = participantDigest({
        principalKey: principal,
        threadId: thread.id,
      });
      return {
        ...thread,
        ...(executionByThreadId === null
          ? {}
          : {
              experimental_execution: executionByThreadId.get(thread.id),
            }),
        participantSummary: {
          totalCount: participantPage.totalCount,
          profiles: [...participantPage.profiles],
          nextCursor: encodeParticipantCursor({
            digest: participantCursorDigest,
            position: participantPage.nextPosition,
            signingKey,
          }),
        },
      };
    });
    const lastPosition = page.positions.at(-1);
    return {
      threads,
      facetStates: ownerProjections.map(({ ownerState, typeId }) => ({
        typeId,
        ownerState,
      })),
      nextCursor:
        page.hasMore && lastPosition
          ? cursorEncode(
              {
                version: 1,
                digest: expectedDigest,
                position: lastPosition,
              },
              signingKey,
            )
          : null,
    };
  } catch (error) {
    mapFacetInvariant(error);
  }
}

export function executeThreadFacetParticipantPage(
  deps: Pick<AppDeps, "db">,
  args: {
    actor: P6rActorSnapshot | null;
    cursor?: string;
    pageSize: number;
    threadId: string;
  },
): ThreadFacetParticipantsResponse {
  requirePublicThread(deps.db, args.threadId);
  ensureCoreParticipantsProjection(deps.db, [args.threadId]);
  const signingKey = getOrCreateThreadFacetCursorSigningKey(deps.db);
  const expectedDigest = participantDigest({
    principalKey: requestPrincipalKey(args.actor),
    threadId: args.threadId,
  });
  const afterPosition = decodeParticipantCursor({
    cursor: args.cursor,
    digest: expectedDigest,
    signingKey,
  });
  const page = listCoreParticipantProfilePage(deps.db, {
    threadId: args.threadId,
    pageSize: args.pageSize,
    ...(afterPosition === undefined ? {} : { afterPosition }),
  });
  return {
    totalCount: page.totalCount,
    profiles: [...page.profiles],
    nextCursor: encodeParticipantCursor({
      digest: expectedDigest,
      position: page.nextPosition,
      signingKey,
    }),
  };
}
