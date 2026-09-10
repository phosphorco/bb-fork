import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { inArray } from "drizzle-orm";
import {
  getOrCreateThreadFacetCursorSigningKey,
  listLastStoredTurnRequestEventsByThreadIds,
  listProjectExecutionDefaultsByProjectIds,
  listThreadExecutionOverridesByThreadIds,
  listThreadExecutionProjectionRowsByIds,
  listThreadIdsMissingCoreParticipantProjection,
  listThreadsWithPendingInteractionStateByIds,
  listCoreParticipantProfilePage,
  listCoreParticipantSummariesByThreadIds,
  listThreadFacetOwnerProjections,
  queryThreadFacetThreadIds,
  replaceCoreParticipantProfilesBatch,
  ThreadFacetInvariantError,
} from "@bb/db";
import type {
  ResolvedThreadFacetFilter,
  ReasoningLevel,
  ThreadFacetFilter,
  ThreadFacetQueryRequest,
} from "@bb/domain";
import { providerModelCatalogDependsOnWorkspace } from "@bb/domain";
import type {
  ExperimentalThreadExecutionSummary,
  ThreadFacetParticipantsResponse,
  ThreadFacetQueryResponse,
} from "@bb/server-contract";
import { z } from "zod";
import type { AppDeps } from "../../types.js";
import type { DbQueryConnection } from "@bb/db";
import { ApiError } from "../../errors.js";
import {
  requirePublicProject,
  requirePublicThread,
} from "../lib/entity-lookup.js";
import { toThreadListEntryResponses } from "./thread-runtime-display.js";
import { DEFAULT_REASONING_LEVEL } from "./thread-default-policy.js";
import { parseStoredTurnRequestEvent } from "./thread-events.js";
import type { ProviderRegistryService } from "../providers/provider-registry.js";
import { p6rContributions } from "../p6r/sidecar-schema.js";

const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_CURSOR_BYTES = 4 * 1024;

const queryCursorSchema = z
  .object({
    version: z.literal(1),
    digest: z.string().length(64),
    position: z
      .object({
        threadId: z.string().min(1),
        updatedAt: z.number().int().nonnegative().nullable(),
        state: z.number().int().nonnegative().nullable(),
        rank: z.number().int().nonnegative().nullable(),
      })
      .strict(),
  })
  .strict();
const participantCursorSchema = z
  .object({
    version: z.literal(1),
    digest: z.string().length(64),
    position: z.number().int().nonnegative(),
  })
  .strict();
const storedActorSchema = z
  .object({
    identity: z.discriminatedUnion("kind", [
      z
        .object({
          key: z.string().min(1),
          kind: z.literal("person"),
          issuer: z.string().min(1),
          subject: z.string().min(1),
        })
        .passthrough(),
      z
        .object({
          key: z.string().min(1),
          kind: z.literal("external"),
          pluginId: z.string().min(1),
          subject: z.string().min(1),
        })
        .passthrough(),
    ]),
    presentation: z
      .object({
        displayName: z.string().min(1),
        avatarUrl: z.string().min(1).nullable(),
      })
      .passthrough(),
  })
  .passthrough();

function digest(value: object): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function encodeCursor(value: object, key: string): string {
  const payload = Buffer.from(JSON.stringify(value), "utf8").toString(
    "base64url",
  );
  const signature = createHmac("sha256", Buffer.from(key, "hex"))
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function decodeCursor(cursor: string, key: string): unknown {
  if (Buffer.byteLength(cursor, "utf8") > MAX_CURSOR_BYTES)
    throw new ApiError(400, "invalid_cursor", "Cursor is too large");
  try {
    const [payload, supplied, extra] = cursor.split(".");
    if (payload === undefined || supplied === undefined || extra !== undefined)
      throw new Error("Invalid cursor envelope");
    const expected = createHmac("sha256", Buffer.from(key, "hex"))
      .update(payload)
      .digest();
    const signature = Buffer.from(supplied, "base64url");
    if (
      signature.byteLength !== expected.byteLength ||
      !timingSafeEqual(signature, expected)
    )
      throw new Error("Invalid cursor signature");
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new ApiError(400, "invalid_cursor", "Cursor is malformed");
  }
}

function resolveFilters(
  filters: readonly ThreadFacetFilter[],
  actorKey: string | null,
): ResolvedThreadFacetFilter[] {
  return filters.map((filter) => {
    if (filter.operator === "present" || filter.operator === "absent")
      return filter;
    if (typeof filter.member === "string") {
      return {
        typeId: filter.typeId,
        operator: filter.operator,
        member: filter.member,
      };
    }
    if (actorKey === null)
      throw new ApiError(
        401,
        "authentication_required",
        "The request-principal perspective requires an admitted native identity",
      );
    return {
      typeId: filter.typeId,
      operator: filter.operator,
      member: actorKey,
    };
  });
}

function mapInvariant(error: unknown): never {
  if (!(error instanceof ThreadFacetInvariantError)) throw error;
  throw new ApiError(
    400,
    error.code === "facet_unavailable"
      ? "facet_unavailable"
      : "invalid_request",
    error.code === "facet_unavailable"
      ? "The requested facet is unavailable"
      : "The facet query is invalid",
  );
}

function ensureNativeParticipantProjection(
  deps: AppDeps,
  threadIds: readonly string[],
): void {
  if (threadIds.length === 0) return;
  const rowsByThreadId = new Map<
    string,
    Array<{
      acceptedAt: number;
      acceptedAuthorship: string;
      latestEditor: string;
    }>
  >(threadIds.map((threadId) => [threadId, []]));
  const rows = deps.db
    .select({
      threadId: p6rContributions.threadId,
      acceptedAt: p6rContributions.acceptedAt,
      acceptedAuthorship: p6rContributions.acceptedAuthorship,
      latestEditor: p6rContributions.latestEditor,
    })
    .from(p6rContributions)
    .where(inArray(p6rContributions.threadId, [...new Set(threadIds)]))
    .all();
  for (const row of rows) rowsByThreadId.get(row.threadId)?.push(row);
  const replacements: Array<{
    profiles: Array<{
      p6rPrincipalKey: string;
      identityKind: "external" | "person";
      p6rDisplayName: string;
      imageUrl: string | null;
    }>;
    sourceVersion: number;
    threadId: string;
  }> = [];
  for (const threadId of threadIds) {
    const contributionRows = rowsByThreadId.get(threadId) ?? [];
    const byKey = new Map<
      string,
      {
        p6rPrincipalKey: string;
        identityKind: "external" | "person";
        p6rDisplayName: string;
        imageUrl: string | null;
      }
    >();
    let sourceVersion = 0;
    for (const row of contributionRows) {
      sourceVersion = Math.max(sourceVersion, row.acceptedAt);
      for (const value of [row.acceptedAuthorship, row.latestEditor]) {
        try {
          const parsed = storedActorSchema.safeParse(JSON.parse(value));
          if (!parsed.success) continue;
          byKey.set(parsed.data.identity.key, {
            p6rPrincipalKey: parsed.data.identity.key,
            identityKind: parsed.data.identity.kind,
            p6rDisplayName: parsed.data.presentation.displayName,
            imageUrl: parsed.data.presentation.avatarUrl,
          });
        } catch {}
      }
    }
    replacements.push({
      threadId,
      sourceVersion,
      profiles: [...byKey.values()].sort((left, right) =>
        left.p6rPrincipalKey.localeCompare(right.p6rPrincipalKey),
      ),
    });
  }
  replaceCoreParticipantProfilesBatch(deps.db, replacements);
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
  fallbackModel: string | null;
  fallbackReasoningLevel: ReasoningLevel | null;
  summary: ExperimentalThreadExecutionSummary;
}

function executionCatalogDependsOnWorkspace(
  registry: ProviderRegistryService,
  providerId: string,
): boolean {
  return providerModelCatalogDependsOnWorkspace(
    registry.get(providerId)?.info.capabilities.modelCatalogScope,
  );
}

export function buildThreadExecutionProjectionDetails(
  deps: { db: DbQueryConnection; providerRegistry: ProviderRegistryService },
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
    const effectiveReasoningLevel =
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
    const witness = digest({
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
    });
    const base = {
      providerId: thread.providerId,
      catalogDependsOnWorkspace: executionCatalogDependsOnWorkspace(
        deps.providerRegistry,
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
  deps: { db: DbQueryConnection; providerRegistry: ProviderRegistryService },
  threads: readonly ThreadExecutionProjectionInput[],
): Map<string, ExperimentalThreadExecutionSummary> {
  return new Map(
    [...buildThreadExecutionProjectionDetails(deps, threads)].map(
      ([threadId, details]) => [threadId, details.summary],
    ),
  );
}

export function executeThreadFacetQuery(
  deps: AppDeps,
  args: { actorKey?: string | null; request: ThreadFacetQueryRequest },
): ThreadFacetQueryResponse {
  if (
    Buffer.byteLength(JSON.stringify(args.request), "utf8") > MAX_REQUEST_BYTES
  )
    throw new ApiError(400, "invalid_request", "Facet query is too large");
  if (args.request.scope.projectId !== undefined)
    requirePublicProject(deps.db, args.request.scope.projectId);
  if (
    args.request.scope.sectionId !== undefined &&
    args.request.scope.unsectioned === true
  )
    throw new ApiError(
      400,
      "invalid_request",
      "sectionId and unsectioned cannot be used together",
    );
  const filters = resolveFilters(args.request.filters, args.actorKey ?? null);
  if (filters.some((filter) => filter.typeId === "core/participants")) {
    const missing = listThreadIdsMissingCoreParticipantProjection(deps.db, {
      ...args.request.scope,
      includeHidden: args.request.scope.includeHidden ?? false,
      limit: 200,
    });
    ensureNativeParticipantProjection(deps, missing.threadIds);
    if (missing.hasMore) {
      throw new ApiError(
        409,
        "facet_reconciling",
        "Native participant projection is rebuilding; retry this exact query",
      );
    }
  }
  const key = getOrCreateThreadFacetCursorSigningKey(deps.db);
  const queryDigest = digest({
    actorKey: args.actorKey ?? "anonymous",
    filters: [...filters].sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    ),
    order: args.request.order ?? null,
    pageSize: args.request.pageSize,
    scope: args.request.scope,
    includeExecution: args.request.experimental_includeExecution ?? false,
  });
  const decoded =
    args.request.cursor === undefined
      ? undefined
      : queryCursorSchema.safeParse(decodeCursor(args.request.cursor, key));
  if (
    decoded !== undefined &&
    (!decoded.success || decoded.data.digest !== queryDigest)
  )
    throw new ApiError(
      400,
      "invalid_cursor",
      "Cursor does not match this facet query",
    );
  try {
    const page = queryThreadFacetThreadIds(deps.db, {
      ...args.request.scope,
      includeHidden: args.request.scope.includeHidden ?? false,
      filters,
      pageSize: args.request.pageSize,
      ...(decoded?.success ? { after: decoded.data.position } : {}),
    });
    ensureNativeParticipantProjection(deps, page.threadIds);
    const threadRows = new Map(
      listThreadsWithPendingInteractionStateByIds(deps.db, page.threadIds).map(
        (thread) => [thread.id, thread] as const,
      ),
    );
    const rowsById = new Map(
      toThreadListEntryResponses(deps, {
        threads: [...threadRows.values()],
      }).map((thread) => [thread.id, thread] as const),
    );
    const rows = page.threadIds.flatMap((threadId) => {
      const row = rowsById.get(threadId);
      return row === undefined ? [] : [row];
    });
    const participantSummaries = listCoreParticipantSummariesByThreadIds(
      deps.db,
      rows.map((thread) => thread.id),
      3,
    );
    const executionByThreadId = args.request.experimental_includeExecution
      ? buildThreadExecutionProjection(
          deps,
          listThreadExecutionProjectionRowsByIds(
            deps.db,
            rows.map((row) => row.id),
          ).map((row) => ({ ...row, id: row.threadId })),
        )
      : new Map<string, ExperimentalThreadExecutionSummary>();
    return {
      threads: rows.map((thread) => {
        const participants = participantSummaries.get(thread.id) ?? {
          totalCount: 0,
          profiles: [],
          nextPosition: null,
        };
        const participantDigest = digest({
          actorKey: args.actorKey ?? "anonymous",
          threadId: thread.id,
        });
        return {
          ...thread,
          participantSummary: {
            totalCount: participants.totalCount,
            profiles: participants.profiles.map(
              ({
                p6rPrincipalKey,
                identityKind,
                p6rDisplayName,
                imageUrl,
              }) => ({
                p6rPrincipalKey,
                p6rIdentityKind: identityKind,
                p6rDisplayName,
                p6rImageUrl: imageUrl,
              }),
            ),
            nextCursor:
              participants.nextPosition === null
                ? null
                : encodeCursor(
                    {
                      version: 1,
                      digest: participantDigest,
                      position: participants.nextPosition,
                    },
                    key,
                  ),
          },
          ...(args.request.experimental_includeExecution
            ? { experimental_execution: executionByThreadId.get(thread.id) }
            : {}),
        };
      }),
      nextCursor: page.hasMore
        ? encodeCursor(
            {
              version: 1,
              digest: queryDigest,
              position: page.positions.at(-1),
            },
            key,
          )
        : null,
      facetStates: listThreadFacetOwnerProjections(deps.db, [
        ...new Set([
          ...filters.map((filter) => filter.typeId),
          ...(args.request.order === undefined
            ? []
            : [args.request.order.typeId]),
        ]),
      ]).map(({ typeId, ownerState }) => ({ typeId, ownerState })),
    };
  } catch (error) {
    return mapInvariant(error);
  }
}

export function executeThreadFacetParticipantPage(
  deps: AppDeps,
  args: {
    actorKey?: string | null;
    cursor?: string;
    pageSize: number;
    threadId: string;
  },
): ThreadFacetParticipantsResponse {
  requirePublicThread(deps.db, args.threadId);
  ensureNativeParticipantProjection(deps, [args.threadId]);
  const key = getOrCreateThreadFacetCursorSigningKey(deps.db);
  const expectedDigest = digest({
    actorKey: args.actorKey ?? "anonymous",
    threadId: args.threadId,
  });
  const decoded =
    args.cursor === undefined
      ? undefined
      : participantCursorSchema.safeParse(decodeCursor(args.cursor, key));
  if (
    decoded !== undefined &&
    (!decoded.success || decoded.data.digest !== expectedDigest)
  )
    throw new ApiError(
      400,
      "invalid_cursor",
      "Cursor does not match this participant list",
    );
  const page = listCoreParticipantProfilePage(deps.db, {
    threadId: args.threadId,
    pageSize: args.pageSize,
    ...(decoded?.success ? { afterPosition: decoded.data.position } : {}),
  });
  return {
    totalCount: page.totalCount,
    profiles: page.profiles.map(
      ({ p6rPrincipalKey, identityKind, p6rDisplayName, imageUrl }) => ({
        p6rPrincipalKey,
        p6rIdentityKind: identityKind,
        p6rDisplayName,
        p6rImageUrl: imageUrl,
      }),
    ),
    nextCursor:
      page.nextPosition === null
        ? null
        : encodeCursor(
            { version: 1, digest: expectedDigest, position: page.nextPosition },
            key,
          ),
  };
}
