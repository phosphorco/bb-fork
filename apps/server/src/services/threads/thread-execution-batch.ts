import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  getOrCreateThreadFacetCursorSigningKey,
  listThreadExecutionProjectionRowsByIds,
  setThreadExecutionOverridesBatch,
  type SetThreadExecutionOverrideBatchInput,
  type ThreadExecutionProjectionRow,
} from "@bb/db";
import type {
  ExperimentalThreadExecutionApplyRequest,
  ExperimentalThreadExecutionApplyResponse,
  ExperimentalThreadExecutionPreflightRequest,
  ExperimentalThreadExecutionPreflightResponse,
} from "@bb/server-contract";
import { reasoningLevelSchema, type AvailableModel } from "@bb/domain";
import { z } from "zod";
import type { LoggedWorkSessionDeps } from "../../types.js";
import { resolveSystemProviderModels } from "../system/execution-options.js";
import { resolveSystemLookupHostId } from "../system/host-lookup.js";
import {
  buildThreadExecutionProjection,
  buildThreadExecutionProjectionDetails,
} from "./thread-facet-query.js";
import { resolveThreadExecutionOverrideUpdate } from "./thread-execution-override.js";

const TOKEN_TTL_MS = 5 * 60 * 1_000;
const MAX_ROUTES = 100;

const tokenSchema = z
  .object({
    version: z.literal(1),
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
type Token = z.infer<typeof tokenSchema>;
interface Route {
  environmentId: string | null;
  hostId: string;
  key: string;
  providerId: string;
  registrationRevision: number;
  workspacePath: string | null;
}
interface Catalog {
  error: boolean;
  fingerprint: string | null;
  models: readonly AvailableModel[];
  route: Route;
}

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function inputs(rows: readonly ThreadExecutionProjectionRow[]) {
  return rows.map((row) => ({ ...row, id: row.threadId }));
}
function route(
  deps: LoggedWorkSessionDeps,
  row: ThreadExecutionProjectionRow,
): Route {
  const hostId = row.hostId ?? resolveSystemLookupHostId(deps, {});
  const workspacePath = row.path;
  const registrationRevision = deps.providerRegistry.getRegistrationRevision();
  return {
    environmentId: row.environmentId,
    hostId,
    providerId: row.providerId,
    workspacePath,
    registrationRevision,
    key: JSON.stringify([
      row.providerId,
      hostId,
      workspacePath,
      registrationRevision,
    ]),
  };
}
function sameRoute(left: Route, right: Token) {
  return (
    left.providerId === right.providerId &&
    left.environmentId === right.environmentId &&
    left.hostId === right.hostId &&
    left.workspacePath === right.workspacePath &&
    left.registrationRevision === right.registrationRevision
  );
}
function encode(token: Token, key: string) {
  const body = Buffer.from(JSON.stringify(token)).toString("base64url");
  return `${body}.${createHmac("sha256", Buffer.from(key, "hex")).update(body).digest("base64url")}`;
}
function decode(value: string, key: string): Token | null {
  try {
    const [body, signature, extra] = value.split(".");
    if (!body || !signature || extra !== undefined) return null;
    const expected = createHmac("sha256", Buffer.from(key, "hex"))
      .update(body)
      .digest();
    const supplied = Buffer.from(signature, "base64url");
    if (
      supplied.byteLength !== expected.byteLength ||
      !timingSafeEqual(supplied, expected)
    )
      return null;
    const parsed = tokenSchema.safeParse(
      JSON.parse(Buffer.from(body, "base64url").toString("utf8")),
    );
    return parsed.success && parsed.data.expiresAt > Date.now()
      ? parsed.data
      : null;
  } catch {
    return null;
  }
}
async function catalogs(
  deps: LoggedWorkSessionDeps,
  rows: readonly ThreadExecutionProjectionRow[],
  fresh = false,
) {
  const routes = new Map<string, Route>();
  const byThread = new Map<string, Route>();
  for (const row of rows) {
    try {
      const value = route(deps, row);
      routes.set(value.key, value);
      byThread.set(row.threadId, value);
    } catch {}
  }
  const result = new Map<string, Catalog>();
  if (routes.size > MAX_ROUTES) {
    for (const value of routes.values())
      result.set(value.key, {
        error: true,
        fingerprint: null,
        models: [],
        route: value,
      });
    return { byThread, result };
  }
  await Promise.all(
    [...routes.values()].map(async (value) => {
      try {
        const response = await resolveSystemProviderModels(deps, {
          providerId: value.providerId,
          hostId: value.hostId,
          fresh,
          ...(value.workspacePath === null ? {} : { cwd: value.workspacePath }),
        });
        const models = [...response.models, ...response.selectedOnlyModels];
        result.set(value.key, {
          error: response.modelLoadError !== null,
          fingerprint:
            response.modelLoadError === null
              ? digest({ route: value, models })
              : null,
          models,
          route: value,
        });
      } catch {
        result.set(value.key, {
          error: true,
          fingerprint: null,
          models: [],
          route: value,
        });
      }
    }),
  );
  return { byThread, result };
}
export async function preflightThreadExecutionOverrides(
  deps: LoggedWorkSessionDeps,
  request: ExperimentalThreadExecutionPreflightRequest,
): Promise<ExperimentalThreadExecutionPreflightResponse> {
  const rows = listThreadExecutionProjectionRowsByIds(
    deps.db,
    request.items.map((item) => item.threadId),
  );
  const byId = new Map(rows.map((row) => [row.threadId, row]));
  const details = buildThreadExecutionProjectionDetails(deps, inputs(rows));
  const loaded = await catalogs(deps, rows);
  const key = getOrCreateThreadFacetCursorSigningKey(deps.db);
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  return {
    results: request.items.map((item) => {
      const row = byId.get(item.threadId);
      const detail = details.get(item.threadId);
      if (!row || !detail)
        return {
          status: "unavailable" as const,
          threadId: item.threadId,
          reason: "thread-not-found" as const,
          message: "Thread is no longer available",
        };
      if (detail.summary.witness !== item.witness)
        return {
          status: "stale" as const,
          threadId: item.threadId,
          current: detail.summary,
        };
      const selected = loaded.byThread.get(item.threadId);
      const catalog = selected ? loaded.result.get(selected.key) : undefined;
      if (!selected || !catalog || catalog.error || !catalog.fingerprint)
        return {
          status: "unavailable" as const,
          threadId: item.threadId,
          reason: "catalog-unavailable" as const,
          message: `Unable to load ${row.providerId}'s model catalog`,
          current: detail.summary,
        };
      if (item.patch.model === null && detail.fallbackModel === null)
        return {
          status: "unavailable" as const,
          threadId: item.threadId,
          reason: "invalid-target" as const,
          message:
            "This thread has no next-turn fallback model; choose an explicit model instead",
          current: detail.summary,
        };
      if (
        detail.summary.state === "unresolved" &&
        item.patch.model === undefined
      )
        return {
          status: "unavailable" as const,
          threadId: item.threadId,
          reason: "unresolved-execution" as const,
          message:
            "A model must be selected before this thread can be reassigned",
          current: detail.summary,
        };
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
            fallbackModel: detail.fallbackModel,
          },
        );
        return {
          status: "ready" as const,
          threadId: item.threadId,
          current: detail.summary,
          nextModelOverride: next.modelOverride,
          nextReasoningLevelOverride: next.reasoningLevelOverride,
          nextEffectiveModel: next.modelOverride ?? detail.fallbackModel,
          nextEffectiveReasoningLevel:
            next.reasoningLevelOverride ?? detail.fallbackReasoningLevel,
          unchanged:
            row.modelOverride === next.modelOverride &&
            row.reasoningLevelOverride === next.reasoningLevelOverride,
          applyToken: encode(
            {
              version: 1,
              expiresAt,
              threadId: item.threadId,
              witness: detail.summary.witness,
              providerId: selected.providerId,
              environmentId: selected.environmentId,
              hostId: selected.hostId,
              workspacePath: selected.workspacePath,
              registrationRevision: selected.registrationRevision,
              catalogFingerprint: catalog.fingerprint,
              modelOverride: next.modelOverride,
              reasoningLevelOverride: next.reasoningLevelOverride,
            },
            key,
          ),
        };
      } catch {
        return {
          status: "unavailable" as const,
          threadId: item.threadId,
          reason: "invalid-target" as const,
          message: "The requested model or reasoning level is unavailable",
          current: detail.summary,
        };
      }
    }),
  };
}
export async function applyPreflightedThreadExecutionOverrides(
  deps: LoggedWorkSessionDeps,
  request: ExperimentalThreadExecutionApplyRequest,
): Promise<ExperimentalThreadExecutionApplyResponse> {
  const key = getOrCreateThreadFacetCursorSigningKey(deps.db);
  const decoded = request.items.map((item) => ({
    item,
    token: decode(item.applyToken, key),
  }));
  const valid = decoded.filter(
    (entry): entry is typeof entry & { token: Token } =>
      entry.token !== null && entry.token.threadId === entry.item.threadId,
  );
  const initial = listThreadExecutionProjectionRowsByIds(
    deps.db,
    valid.map(({ item }) => item.threadId),
  );
  const initialById = new Map(initial.map((row) => [row.threadId, row]));
  const loaded = await catalogs(deps, initial, true);
  const rejected = new Map<
    string,
    ExperimentalThreadExecutionApplyResponse["results"][number]
  >();
  for (const entry of decoded) {
    if (!entry.token || entry.token.threadId !== entry.item.threadId) {
      rejected.set(entry.item.threadId, {
        status: "rejected",
        threadId: entry.item.threadId,
        reason: "invalid-token",
        retryable: false,
      });
      continue;
    }
    const row = initialById.get(entry.item.threadId);
    const current = row && loaded.byThread.get(row.threadId);
    const catalog = current && loaded.result.get(current.key);
    if (!row)
      rejected.set(entry.item.threadId, {
        status: "rejected",
        threadId: entry.item.threadId,
        reason: "thread-not-found",
        retryable: false,
      });
    else if (
      !current ||
      !catalog ||
      catalog.error ||
      catalog.fingerprint !== entry.token.catalogFingerprint ||
      !sameRoute(current, entry.token)
    )
      rejected.set(entry.item.threadId, {
        status: "rejected",
        threadId: entry.item.threadId,
        reason: "catalog-changed",
        retryable: true,
      });
  }
  const candidates = valid.filter(({ item }) => !rejected.has(item.threadId));
  const changedByProject = new Map<string, string[]>();
  let transactional: ExperimentalThreadExecutionApplyResponse["results"] = [];
  try {
    transactional = deps.db.transaction(
      (tx) => {
        const rows = listThreadExecutionProjectionRowsByIds(
          tx,
          candidates.map(({ item }) => item.threadId),
        );
        const byId = new Map(rows.map((row) => [row.threadId, row]));
        const summaries = buildThreadExecutionProjection(
          { db: tx, providerRegistry: deps.providerRegistry },
          inputs(rows),
        );
        const writes: SetThreadExecutionOverrideBatchInput[] = [];
        const results = new Map<
          string,
          ExperimentalThreadExecutionApplyResponse["results"][number]
        >();
        for (const { item, token } of candidates) {
          if (token.expiresAt <= Date.now()) {
            results.set(item.threadId, {
              status: "rejected",
              threadId: item.threadId,
              reason: "invalid-token",
              retryable: false,
            });
            continue;
          }
          if (
            token.registrationRevision !==
            deps.providerRegistry.getRegistrationRevision()
          ) {
            results.set(item.threadId, {
              status: "rejected",
              threadId: item.threadId,
              reason: "catalog-changed",
              retryable: true,
            });
            continue;
          }
          const row = byId.get(item.threadId);
          const summary = summaries.get(item.threadId);
          if (!row || !summary) {
            results.set(item.threadId, {
              status: "rejected",
              threadId: item.threadId,
              reason: "thread-not-found",
              retryable: false,
            });
            continue;
          }
          if (summary.witness !== token.witness) {
            results.set(item.threadId, {
              status: "stale",
              threadId: item.threadId,
              current: summary,
            });
            continue;
          }
          if (
            row.modelOverride === token.modelOverride &&
            row.reasoningLevelOverride === token.reasoningLevelOverride
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
            threadId: row.threadId,
            expectedExecutionRevision: row.executionRevision,
            expectedModelOverride: row.modelOverride,
            expectedReasoningLevelOverride: row.reasoningLevelOverride,
            modelOverride: token.modelOverride,
            reasoningLevelOverride: token.reasoningLevelOverride,
          });
        }
        const changed = setThreadExecutionOverridesBatch(tx, writes);
        if (changed.size !== writes.length)
          throw new Error("execution-write-conflict");
        for (const write of writes) {
          results.set(write.threadId, {
            status: "applied",
            threadId: write.threadId,
            finalModelOverride: write.modelOverride,
            finalReasoningLevelOverride: write.reasoningLevelOverride,
          });
          const project = byId.get(write.threadId)!.projectId;
          changedByProject.set(project, [
            ...(changedByProject.get(project) ?? []),
            write.threadId,
          ]);
        }
        return candidates.map(({ item }) => results.get(item.threadId)!);
      },
      { behavior: "immediate" },
    );
  } catch (error) {
    changedByProject.clear();
    deps.logger.error({ error }, "Failed to apply thread execution overrides");
    transactional = candidates.map(({ item }) => ({
      status: "failed" as const,
      threadId: item.threadId,
      reason: "transaction-failed" as const,
      retryable: true,
    }));
  }
  for (const [projectId, threadIds] of changedByProject)
    for (const threadId of threadIds)
      deps.hub.notifyThread(threadId, ["execution-options-changed"], {
        projectId,
      });
  const byId = new Map(
    transactional.map((result) => [result.threadId, result]),
  );
  return {
    results: request.items.map(
      ({ threadId }) => rejected.get(threadId) ?? byId.get(threadId)!,
    ),
  };
}
