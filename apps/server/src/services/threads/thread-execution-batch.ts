import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  getOrCreateThreadFacetCursorSigningKey,
  listThreadExecutionProjectionRowsByIds,
  setThreadExecutionOverridesBatch,
  type ThreadExecutionProjectionRow,
} from "@bb/db";
import {
  providerModelCatalogDependsOnWorkspace,
  reasoningLevelSchema,
  type AvailableModel,
} from "@bb/domain";
import {
  type ExperimentalThreadExecutionApplyRequest,
  type ExperimentalThreadExecutionApplyResponse,
  type ExperimentalThreadExecutionPreflightRequest,
  type ExperimentalThreadExecutionPreflightResponse,
} from "@bb/server-contract";
import { z } from "zod";
import type { LoggedWorkSessionDeps } from "../../types.js";
import { resolveSystemProviderModels } from "../system/execution-options.js";
import { resolveSystemLookupHostId } from "../system/host-lookup.js";
import { buildThreadExecutionProjection } from "./thread-facet-query.js";
import { resolveThreadExecutionOverrideUpdate } from "./thread-execution-override.js";

const APPLY_TOKEN_TTL_MS = 5 * 60 * 1_000;
const CATALOG_LOAD_CONCURRENCY = 4;

const applyTokenPayloadSchema = z
  .object({
    version: z.literal(2),
    expiresAt: z.number().int().positive(),
    threadId: z.string().min(1),
    witness: z.string().regex(/^[a-f0-9]{64}$/u),
    providerId: z.string().min(1),
    environmentId: z.string().min(1).nullable(),
    hostId: z.string().min(1),
    workspacePath: z.string().min(1).nullable(),
    registrationRevision: z.number().int().nonnegative(),
    catalogFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    modelOverride: z.string().min(1).nullable(),
    reasoningLevelOverride: reasoningLevelSchema.nullable(),
  })
  .strict();
type ApplyTokenPayload = z.infer<typeof applyTokenPayloadSchema>;

interface CatalogRoute {
  environmentId: string | null;
  hostId: string;
  key: string;
  providerId: string;
  registrationRevision: number;
  workspacePath: string | null;
}

interface CatalogResult {
  error: "catalog-unavailable" | null;
  fingerprint: string | null;
  models: readonly AvailableModel[];
  route: CatalogRoute;
}

class ThreadExecutionWriteConflictError extends Error {}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function resolveCatalogRoute(
  deps: LoggedWorkSessionDeps,
  thread: ThreadExecutionProjectionRow,
): CatalogRoute {
  const hostId =
    thread.hostId ?? resolveSystemLookupHostId(deps, { hostId: undefined });
  const workspacePath = providerModelCatalogDependsOnWorkspace(
    thread.providerId,
  )
    ? thread.path
    : null;
  const registrationRevision = deps.providerRegistry.getRegistrationRevision();
  return {
    environmentId: thread.environmentId,
    hostId,
    providerId: thread.providerId,
    registrationRevision,
    workspacePath,
    key: JSON.stringify([
      thread.providerId,
      hostId,
      workspacePath,
      registrationRevision,
    ]),
  };
}

function catalogFingerprint(
  route: CatalogRoute,
  models: readonly AvailableModel[],
): string {
  return digest(
    JSON.stringify({
      providerId: route.providerId,
      hostId: route.hostId,
      workspacePath: route.workspacePath,
      registrationRevision: route.registrationRevision,
      models: [...models]
        .map((model) => ({
          model: model.model,
          supportedReasoningEfforts: model.supportedReasoningEfforts,
        }))
        .sort((left, right) => left.model.localeCompare(right.model)),
    }),
  );
}

function encodeApplyToken(
  payload: ApplyTokenPayload,
  signingKey: string,
): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signature = createHmac("sha256", Buffer.from(signingKey, "hex"))
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

function decodeApplyToken(
  token: string,
  signingKey: string,
): ApplyTokenPayload | null {
  try {
    const [body, suppliedSignature, extra] = token.split(".");
    if (!body || !suppliedSignature || extra !== undefined) return null;
    const expected = createHmac("sha256", Buffer.from(signingKey, "hex"))
      .update(body)
      .digest();
    const supplied = Buffer.from(suppliedSignature, "base64url");
    if (
      supplied.byteLength !== expected.byteLength ||
      !timingSafeEqual(supplied, expected)
    ) {
      return null;
    }
    const parsed = applyTokenPayloadSchema.safeParse(
      JSON.parse(Buffer.from(body, "base64url").toString("utf8")),
    );
    if (!parsed.success || parsed.data.expiresAt < Date.now()) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

async function mapWithConcurrency<TValue, TResult>(
  values: readonly TValue[],
  concurrency: number,
  mapper: (value: TValue) => Promise<TResult>,
): Promise<TResult[]> {
  const results = new Array<TResult>(values.length);
  let offset = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (offset < values.length) {
        const index = offset;
        offset += 1;
        results[index] = await mapper(values[index]!);
      }
    }),
  );
  return results;
}

async function loadCatalogs(
  deps: LoggedWorkSessionDeps,
  threads: readonly ThreadExecutionProjectionRow[],
): Promise<Map<string, CatalogResult>> {
  const routes = new Map<string, CatalogRoute>();
  for (const thread of threads) {
    const route = resolveCatalogRoute(deps, thread);
    routes.set(route.key, route);
  }
  const loaded = await mapWithConcurrency(
    [...routes.values()],
    CATALOG_LOAD_CONCURRENCY,
    async (route): Promise<[string, CatalogResult]> => {
      try {
        const response = await resolveSystemProviderModels(deps, {
          providerId: route.providerId,
          hostId: route.hostId,
          ...(route.workspacePath === null ? {} : { cwd: route.workspacePath }),
        });
        if (response.modelLoadError !== null) {
          return [
            route.key,
            {
              error: "catalog-unavailable",
              fingerprint: null,
              models: [],
              route,
            },
          ];
        }
        const models = [...response.models, ...response.selectedOnlyModels];
        return [
          route.key,
          {
            error: null,
            fingerprint: catalogFingerprint(route, models),
            models,
            route,
          },
        ];
      } catch (error) {
        deps.logger.warn(
          { error, providerId: route.providerId, hostId: route.hostId },
          "Failed to load a model catalog for execution override validation",
        );
        return [
          route.key,
          {
            error: "catalog-unavailable",
            fingerprint: null,
            models: [],
            route,
          },
        ];
      }
    },
  );
  return new Map(loaded);
}

function projectionInputs(rows: readonly ThreadExecutionProjectionRow[]) {
  return rows.map((row) => ({
    environmentId: row.environmentId,
    environmentUpdatedAt: row.environmentUpdatedAt,
    executionRevision: row.executionRevision,
    hostId: row.hostId,
    id: row.threadId,
    path: row.path,
    projectId: row.projectId,
    providerId: row.providerId,
  }));
}

function routeMatchesToken(route: CatalogRoute, payload: ApplyTokenPayload) {
  return (
    route.providerId === payload.providerId &&
    route.environmentId === payload.environmentId &&
    route.hostId === payload.hostId &&
    route.workspacePath === payload.workspacePath &&
    route.registrationRevision === payload.registrationRevision
  );
}

export async function preflightThreadExecutionOverrides(
  deps: LoggedWorkSessionDeps,
  request: ExperimentalThreadExecutionPreflightRequest,
): Promise<ExperimentalThreadExecutionPreflightResponse> {
  const rows = listThreadExecutionProjectionRowsByIds(
    deps.db,
    request.items.map(({ threadId }) => threadId),
  );
  const rowsById = new Map(rows.map((row) => [row.threadId, row]));
  const summaries = buildThreadExecutionProjection(
    deps,
    projectionInputs(rows),
  );
  const candidates = request.items.flatMap(({ threadId, witness }) => {
    const row = rowsById.get(threadId);
    const summary = summaries.get(threadId);
    return row && summary?.witness === witness ? [row] : [];
  });
  const catalogs = await loadCatalogs(deps, candidates);
  const signingKey = getOrCreateThreadFacetCursorSigningKey(deps.db);
  const expiresAt = Date.now() + APPLY_TOKEN_TTL_MS;

  return {
    results: request.items.map((item) => {
      const row = rowsById.get(item.threadId);
      const current = summaries.get(item.threadId);
      if (!row || !current) {
        return {
          status: "unavailable" as const,
          threadId: item.threadId,
          reason: "thread-not-found" as const,
          message: "Thread is no longer available",
        };
      }
      if (current.witness !== item.witness) {
        return { status: "stale" as const, threadId: item.threadId, current };
      }
      const route = resolveCatalogRoute(deps, row);
      const catalog = catalogs.get(route.key);
      if (!catalog || catalog.error !== null || catalog.fingerprint === null) {
        return {
          status: "unavailable" as const,
          threadId: item.threadId,
          reason: "catalog-unavailable" as const,
          message: `Unable to load ${row.providerId}'s model catalog`,
          current,
        };
      }
      if (current.state === "unresolved" && item.patch.model === undefined) {
        return {
          status: "unavailable" as const,
          threadId: item.threadId,
          reason: "unresolved-execution" as const,
          message:
            "A model must be selected before this thread can be reassigned",
          current,
        };
      }
      try {
        const next = resolveThreadExecutionOverrideUpdate(
          deps.providerRegistry,
          {
            existing: {
              modelOverride: row.modelOverride,
              reasoningLevelOverride: row.reasoningLevelOverride,
            },
            patch: item.patch,
            models: catalog.models,
            providerId: row.providerId,
            fallbackModel:
              current.state === "resolved" ? current.effectiveModel : null,
          },
        );
        return {
          status: "ready" as const,
          threadId: item.threadId,
          current,
          nextModelOverride: next.modelOverride,
          nextReasoningLevelOverride: next.reasoningLevelOverride,
          applyToken: encodeApplyToken(
            {
              version: 2,
              expiresAt,
              threadId: item.threadId,
              witness: current.witness,
              providerId: route.providerId,
              environmentId: route.environmentId,
              hostId: route.hostId,
              workspacePath: route.workspacePath,
              registrationRevision: route.registrationRevision,
              catalogFingerprint: catalog.fingerprint,
              modelOverride: next.modelOverride,
              reasoningLevelOverride: next.reasoningLevelOverride,
            },
            signingKey,
          ),
        };
      } catch {
        return {
          status: "unavailable" as const,
          threadId: item.threadId,
          reason: "invalid-target" as const,
          message: "The requested model or reasoning level is unavailable",
          current,
        };
      }
    }),
  };
}

export async function applyPreflightedThreadExecutionOverrides(
  deps: LoggedWorkSessionDeps,
  request: ExperimentalThreadExecutionApplyRequest,
): Promise<ExperimentalThreadExecutionApplyResponse> {
  const signingKey = getOrCreateThreadFacetCursorSigningKey(deps.db);
  const decoded = request.items.map((item) => ({
    item,
    payload: decodeApplyToken(item.applyToken, signingKey),
  }));
  const validDecoded = decoded.filter(
    (entry): entry is typeof entry & { payload: ApplyTokenPayload } =>
      entry.payload !== null && entry.payload.threadId === entry.item.threadId,
  );
  const initialRows = listThreadExecutionProjectionRowsByIds(
    deps.db,
    validDecoded.map(({ item }) => item.threadId),
  );
  const initialRowsById = new Map(
    initialRows.map((row) => [row.threadId, row]),
  );
  const catalogs = await loadCatalogs(deps, initialRows);
  const preclassified = new Map<
    string,
    ExperimentalThreadExecutionApplyResponse["results"][number]
  >();
  for (const { item, payload } of decoded) {
    if (payload === null || payload.threadId !== item.threadId) {
      preclassified.set(item.threadId, {
        status: "rejected",
        threadId: item.threadId,
        reason: "invalid-token",
        retryable: false,
      });
      continue;
    }
    const row = initialRowsById.get(item.threadId);
    if (!row) {
      preclassified.set(item.threadId, {
        status: "rejected",
        threadId: item.threadId,
        reason: "thread-not-found",
        retryable: false,
      });
      continue;
    }
    const route = resolveCatalogRoute(deps, row);
    const catalog = catalogs.get(route.key);
    if (
      !routeMatchesToken(route, payload) ||
      !catalog ||
      catalog.error !== null ||
      catalog.fingerprint !== payload.catalogFingerprint
    ) {
      preclassified.set(item.threadId, {
        status: "rejected",
        threadId: item.threadId,
        reason: "catalog-changed",
        retryable: true,
      });
    }
  }

  const candidates = validDecoded.filter(
    ({ item }) => !preclassified.has(item.threadId),
  );
  const changedByProject = new Map<string, string[]>();
  let transactionalResults: ExperimentalThreadExecutionApplyResponse["results"];
  try {
    transactionalResults = deps.db.transaction(
      (tx) => {
        const rows = listThreadExecutionProjectionRowsByIds(
          tx,
          candidates.map(({ item }) => item.threadId),
        );
        const rowsById = new Map(rows.map((row) => [row.threadId, row]));
        const summaries = buildThreadExecutionProjection(
          { db: tx },
          projectionInputs(rows),
        );
        const results = new Map<
          string,
          ExperimentalThreadExecutionApplyResponse["results"][number]
        >();
        const writes = [];
        for (const { item, payload } of candidates) {
          const row = rowsById.get(item.threadId);
          const current = summaries.get(item.threadId);
          if (!row || !current) {
            results.set(item.threadId, {
              status: "rejected",
              threadId: item.threadId,
              reason: "thread-not-found",
              retryable: false,
            });
            continue;
          }
          if (current.witness !== payload.witness) {
            results.set(item.threadId, {
              status: "stale",
              threadId: item.threadId,
              current,
            });
            continue;
          }
          if (
            row.modelOverride === payload.modelOverride &&
            row.reasoningLevelOverride === payload.reasoningLevelOverride
          ) {
            results.set(item.threadId, {
              status: "unchanged",
              threadId: item.threadId,
              finalModelOverride: row.modelOverride,
              finalReasoningLevelOverride: row.reasoningLevelOverride,
            });
            continue;
          }
          writes.push({
            expectedExecutionRevision: row.executionRevision,
            expectedModelOverride: row.modelOverride,
            expectedReasoningLevelOverride: row.reasoningLevelOverride,
            modelOverride: payload.modelOverride,
            reasoningLevelOverride: payload.reasoningLevelOverride,
            threadId: item.threadId,
          });
        }
        const changed = setThreadExecutionOverridesBatch(tx, writes);
        if (changed.size !== writes.length) {
          throw new ThreadExecutionWriteConflictError();
        }
        for (const write of writes) {
          results.set(write.threadId, {
            status: "applied",
            threadId: write.threadId,
            finalModelOverride: write.modelOverride,
            finalReasoningLevelOverride: write.reasoningLevelOverride,
          });
          const projectId = rowsById.get(write.threadId)!.projectId;
          const projectThreadIds = changedByProject.get(projectId) ?? [];
          projectThreadIds.push(write.threadId);
          changedByProject.set(projectId, projectThreadIds);
        }
        return candidates.map(({ item }) => results.get(item.threadId)!);
      },
      { behavior: "immediate" },
    );
  } catch (error) {
    changedByProject.clear();
    deps.logger.error({ error }, "Failed to apply thread execution overrides");
    transactionalResults = candidates.map(({ item }) => ({
      status: "failed" as const,
      threadId: item.threadId,
      reason:
        error instanceof ThreadExecutionWriteConflictError
          ? ("write-conflict" as const)
          : ("transaction-failed" as const),
      retryable: true,
    }));
  }

  for (const [projectId, threadIds] of changedByProject) {
    deps.hub.notifyThreadBatch(threadIds, ["execution-options-changed"], {
      projectId,
    });
  }
  const transactionalById = new Map(
    transactionalResults.map((result) => [result.threadId, result]),
  );
  return {
    results: request.items.map(
      ({ threadId }) =>
        preclassified.get(threadId) ?? transactionalById.get(threadId)!,
    ),
  };
}
