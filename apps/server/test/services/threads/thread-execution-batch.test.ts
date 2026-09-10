import {
  getThreadExecutionOverride,
  listThreadExecutionProjectionRowsByIds,
  setThreadExecutionOverride,
  updateThread,
  upsertProjectExecutionDefaults,
} from "@bb/db";
import { describe, expect, it, vi } from "vitest";
import {
  applyPreflightedThreadExecutionOverrides,
  preflightThreadExecutionOverrides,
} from "../../../src/services/threads/thread-execution-batch.js";
import {
  buildThreadExecutionProjection,
  executeThreadFacetQuery,
} from "../../../src/services/threads/thread-facet-query.js";
import { availableModelFixture } from "../../helpers/available-models.js";
import {
  registerHostRpcResponder,
  registerProviderHostRpcResponder,
} from "../../helpers/host-rpc.js";
import {
  seedEnvironment,
  seedHostSession,
  seedProjectWithSource,
  seedThread,
} from "../../helpers/seed.js";
import { withTestHarness } from "../../helpers/test-app.js";

describe("thread execution override batches", () => {
  it("preflights catalog validation and applies the signed result", async () => {
    await withTestHarness(async (harness) => {
      const { host, session } = seedHostSession(harness.deps, {
        id: "host-execution-batch",
      });
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
        path: "/tmp/thread-execution-batch",
      });
      const environment = seedEnvironment(harness.deps, {
        hostId: host.id,
        projectId: project.id,
        path: "/tmp/thread-execution-batch",
        status: "ready",
      });
      const thread = seedThread(harness.deps, {
        environmentId: environment.id,
        projectId: project.id,
        providerId: "claude-code",
        status: "idle",
      });
      setThreadExecutionOverride(harness.db, {
        threadId: thread.id,
        modelOverride: "claude-fable-5",
        reasoningLevelOverride: "medium",
      });
      const responder = registerProviderHostRpcResponder(harness, {
        hostId: host.id,
        sessionId: session.id,
        modelsByProviderId: {
          "claude-code": {
            models: [
              availableModelFixture({
                model: "claude-opus-5",
                reasoningLevels: ["medium", "high"],
              }),
            ],
            selectedOnlyModels: [],
          },
        },
      });
      const facet = executeThreadFacetQuery(harness.deps, {
        actor: null,
        request: {
          scope: { projectId: project.id },
          filters: [],
          pageSize: 10,
          experimental_includeExecution: true,
        },
      });
      const current = facet.threads[0]?.experimental_execution;
      if (!current) throw new Error("Expected execution projection");

      // Reading or organizing a thread updates generic metadata, but must not
      // invalidate an execution-only preflight witness.
      updateThread(harness.db, harness.hub, thread.id, {
        lastReadAt: Date.now(),
      });

      expect(
        (
          await preflightThreadExecutionOverrides(harness.deps, {
            items: [
              {
                threadId: thread.id,
                witness: current.witness,
                patch: { model: null },
              },
            ],
          })
        ).results[0],
      ).toMatchObject({
        status: "unavailable",
        reason: "invalid-target",
        threadId: thread.id,
      });

      const preflight = await preflightThreadExecutionOverrides(harness.deps, {
        items: [
          {
            threadId: thread.id,
            witness: current.witness,
            patch: { model: "claude-opus-5", reasoningLevel: "high" },
          },
        ],
      });
      expect(preflight.results[0]).toMatchObject({
        status: "ready",
        threadId: thread.id,
        nextModelOverride: "claude-opus-5",
        nextReasoningLevelOverride: "high",
        nextEffectiveModel: "claude-opus-5",
        nextEffectiveReasoningLevel: "high",
        unchanged: false,
      });
      const ready = preflight.results[0];
      if (ready?.status !== "ready") throw new Error("Expected ready result");

      expect(
        (
          await applyPreflightedThreadExecutionOverrides(harness.deps, {
            items: [
              {
                threadId: thread.id,
                applyToken: `${ready.applyToken}tampered`,
              },
            ],
          })
        ).results,
      ).toEqual([
        {
          status: "rejected",
          threadId: thread.id,
          reason: "invalid-token",
          retryable: false,
        },
      ]);
      expect(getThreadExecutionOverride(harness.db, thread.id)).toEqual({
        modelOverride: "claude-fable-5",
        reasoningLevelOverride: "medium",
      });

      expect(
        (
          await applyPreflightedThreadExecutionOverrides(harness.deps, {
            items: [{ threadId: thread.id, applyToken: ready.applyToken }],
          })
        ).results,
      ).toEqual([
        {
          status: "applied",
          threadId: thread.id,
          finalModelOverride: "claude-opus-5",
          finalReasoningLevelOverride: "high",
        },
      ]);
      expect(getThreadExecutionOverride(harness.db, thread.id)).toEqual({
        modelOverride: "claude-opus-5",
        reasoningLevelOverride: "high",
      });
      expect(
        responder.requests.filter(
          ({ command }) => command.type === "provider.list_models",
        ),
      ).toHaveLength(2);
    });
  });

  it("rejects an apply when execution state changed after preflight", async () => {
    await withTestHarness(async (harness) => {
      const { host, session } = seedHostSession(harness.deps, {
        id: "host-execution-batch-stale",
      });
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
        path: "/tmp/thread-execution-batch-stale",
      });
      const environment = seedEnvironment(harness.deps, {
        hostId: host.id,
        projectId: project.id,
        path: "/tmp/thread-execution-batch-stale",
        status: "ready",
      });
      const thread = seedThread(harness.deps, {
        environmentId: environment.id,
        projectId: project.id,
        providerId: "claude-code",
      });
      setThreadExecutionOverride(harness.db, {
        threadId: thread.id,
        modelOverride: "claude-fable-5",
      });
      registerProviderHostRpcResponder(harness, {
        hostId: host.id,
        sessionId: session.id,
        modelsByProviderId: {
          "claude-code": {
            models: [availableModelFixture({ model: "claude-opus-5" })],
            selectedOnlyModels: [],
          },
        },
      });
      const current = executeThreadFacetQuery(harness.deps, {
        actor: null,
        request: {
          scope: { projectId: project.id },
          filters: [],
          pageSize: 10,
          experimental_includeExecution: true,
        },
      }).threads[0]?.experimental_execution;
      if (!current) throw new Error("Expected execution projection");
      const preflight = await preflightThreadExecutionOverrides(harness.deps, {
        items: [
          {
            threadId: thread.id,
            witness: current.witness,
            patch: { model: "claude-opus-5" },
          },
        ],
      });
      const ready = preflight.results[0];
      if (ready?.status !== "ready") throw new Error("Expected ready result");

      setThreadExecutionOverride(harness.db, {
        threadId: thread.id,
        reasoningLevelOverride: "high",
      });
      const applied = await applyPreflightedThreadExecutionOverrides(
        harness.deps,
        {
          items: [{ threadId: thread.id, applyToken: ready.applyToken }],
        },
      );
      expect(applied.results[0]).toMatchObject({
        status: "stale",
        threadId: thread.id,
      });
      expect(getThreadExecutionOverride(harness.db, thread.id)).toEqual({
        modelOverride: "claude-fable-5",
        reasoningLevelOverride: "high",
      });
    });
  });

  it("reconciles reasoning against the real fallback when clearing a model override", async () => {
    await withTestHarness(async (harness) => {
      const { host, session } = seedHostSession(harness.deps, {
        id: "host-execution-batch-clear",
      });
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
        path: "/tmp/thread-execution-batch-clear",
      });
      const environment = seedEnvironment(harness.deps, {
        hostId: host.id,
        projectId: project.id,
        path: "/tmp/thread-execution-batch-clear",
        status: "ready",
      });
      const thread = seedThread(harness.deps, {
        environmentId: environment.id,
        projectId: project.id,
        providerId: "claude-code",
      });
      upsertProjectExecutionDefaults(harness.db, {
        projectId: project.id,
        providerId: "claude-code",
        model: "claude-haiku-5",
        reasoningLevel: "low",
        permissionMode: "full",
        serviceTier: "default",
      });
      setThreadExecutionOverride(harness.db, {
        threadId: thread.id,
        modelOverride: "claude-fable-5",
        reasoningLevelOverride: "high",
      });
      registerProviderHostRpcResponder(harness, {
        hostId: host.id,
        sessionId: session.id,
        modelsByProviderId: {
          "claude-code": {
            models: [
              availableModelFixture({
                model: "claude-fable-5",
                reasoningLevels: ["medium", "high"],
              }),
              availableModelFixture({
                model: "claude-haiku-5",
                reasoningLevels: ["low"],
                defaultReasoningLevel: "low",
              }),
            ],
            selectedOnlyModels: [],
          },
        },
      });
      const current = executeThreadFacetQuery(harness.deps, {
        actor: null,
        request: {
          scope: { projectId: project.id },
          filters: [],
          pageSize: 10,
          experimental_includeExecution: true,
        },
      }).threads[0]?.experimental_execution;
      if (!current) throw new Error("Expected execution projection");

      const preflight = await preflightThreadExecutionOverrides(harness.deps, {
        items: [
          {
            threadId: thread.id,
            witness: current.witness,
            patch: { model: null },
          },
        ],
      });

      expect(preflight.results[0]).toMatchObject({
        status: "ready",
        nextModelOverride: null,
        nextReasoningLevelOverride: "low",
        nextEffectiveModel: "claude-haiku-5",
        nextEffectiveReasoningLevel: "low",
        unchanged: false,
      });
    });
  });

  it("preserves stale classifications when another write rolls back", async () => {
    await withTestHarness(async (harness) => {
      const { host, session } = seedHostSession(harness.deps, {
        id: "host-execution-batch-rollback",
      });
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
        path: "/tmp/thread-execution-batch-rollback",
      });
      const environment = seedEnvironment(harness.deps, {
        hostId: host.id,
        projectId: project.id,
        path: "/tmp/thread-execution-batch-rollback",
        status: "ready",
      });
      const staleThread = seedThread(harness.deps, {
        environmentId: environment.id,
        projectId: project.id,
        providerId: "claude-code",
        title: "Stale thread",
      });
      const writeThread = seedThread(harness.deps, {
        environmentId: environment.id,
        projectId: project.id,
        providerId: "claude-code",
        title: "Write thread",
      });
      for (const thread of [staleThread, writeThread]) {
        setThreadExecutionOverride(harness.db, {
          threadId: thread.id,
          modelOverride: "claude-fable-5",
          reasoningLevelOverride: "medium",
        });
      }
      registerProviderHostRpcResponder(harness, {
        hostId: host.id,
        sessionId: session.id,
        modelsByProviderId: {
          "claude-code": {
            models: [
              availableModelFixture({ model: "claude-fable-5" }),
              availableModelFixture({ model: "claude-opus-5" }),
            ],
            selectedOnlyModels: [],
          },
        },
      });
      const facet = executeThreadFacetQuery(harness.deps, {
        actor: null,
        request: {
          scope: { projectId: project.id },
          filters: [],
          pageSize: 10,
          experimental_includeExecution: true,
        },
      });
      const witnesses = new Map(
        facet.threads.map((thread) => [
          thread.id,
          thread.experimental_execution?.witness,
        ]),
      );
      const preflight = await preflightThreadExecutionOverrides(harness.deps, {
        items: [staleThread, writeThread].map((thread) => ({
          threadId: thread.id,
          witness: witnesses.get(thread.id) ?? "",
          patch: { model: "claude-opus-5" },
        })),
      });
      const tokens = new Map(
        preflight.results.flatMap((result) =>
          result.status === "ready"
            ? [[result.threadId, result.applyToken] as const]
            : [],
        ),
      );
      expect(tokens.size).toBe(2);

      setThreadExecutionOverride(harness.db, {
        threadId: staleThread.id,
        reasoningLevelOverride: "high",
      });
      harness.db.$client.exec(`
        CREATE TRIGGER force_execution_batch_rollback
        BEFORE UPDATE OF model_override ON threads
        BEGIN
          SELECT RAISE(ABORT, 'forced execution batch rollback');
        END
      `);

      const applied = await applyPreflightedThreadExecutionOverrides(
        harness.deps,
        {
          items: [staleThread, writeThread].map((thread) => ({
            threadId: thread.id,
            applyToken: tokens.get(thread.id) ?? "",
          })),
        },
      );

      expect(applied.results[0]).toMatchObject({
        status: "stale",
        threadId: staleThread.id,
      });
      expect(applied.results[1]).toEqual({
        status: "failed",
        threadId: writeThread.id,
        reason: "transaction-failed",
        retryable: true,
      });
      expect(getThreadExecutionOverride(harness.db, writeThread.id)).toEqual({
        modelOverride: "claude-fable-5",
        reasoningLevelOverride: "medium",
      });
    });
  });

  it("freshly rechecks the catalog before applying a signed token", async () => {
    await withTestHarness(async (harness) => {
      const { host, session } = seedHostSession(harness.deps, {
        id: "host-execution-batch-catalog-refresh",
      });
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
        path: "/tmp/thread-execution-batch-catalog-refresh",
      });
      const environment = seedEnvironment(harness.deps, {
        hostId: host.id,
        projectId: project.id,
        path: "/tmp/thread-execution-batch-catalog-refresh",
        status: "ready",
      });
      const thread = seedThread(harness.deps, {
        environmentId: environment.id,
        projectId: project.id,
        providerId: "claude-code",
      });
      setThreadExecutionOverride(harness.db, {
        threadId: thread.id,
        modelOverride: "claude-fable-5",
      });
      let catalog = [
        availableModelFixture({ model: "claude-fable-5" }),
        availableModelFixture({ model: "claude-opus-5" }),
      ];
      const responder = registerHostRpcResponder(harness, {
        hostId: host.id,
        sessionId: session.id,
        handle: (request) => {
          if (request.command.type !== "provider.list_models") {
            throw new Error(`Unexpected RPC command ${request.command.type}`);
          }
          return {
            ok: true,
            result: { models: catalog, selectedOnlyModels: [] },
          };
        },
      });
      const current = executeThreadFacetQuery(harness.deps, {
        actor: null,
        request: {
          scope: { projectId: project.id },
          filters: [],
          pageSize: 10,
          experimental_includeExecution: true,
        },
      }).threads[0]?.experimental_execution;
      if (!current) throw new Error("Expected execution projection");
      const preflight = await preflightThreadExecutionOverrides(harness.deps, {
        items: [
          {
            threadId: thread.id,
            witness: current.witness,
            patch: { model: "claude-opus-5" },
          },
        ],
      });
      const ready = preflight.results[0];
      if (ready?.status !== "ready") throw new Error("Expected ready result");

      catalog = [availableModelFixture({ model: "claude-fable-5" })];
      const applied = await applyPreflightedThreadExecutionOverrides(
        harness.deps,
        {
          items: [{ threadId: thread.id, applyToken: ready.applyToken }],
        },
      );

      expect(applied.results).toEqual([
        {
          status: "rejected",
          threadId: thread.id,
          reason: "catalog-changed",
          retryable: true,
        },
      ]);
      expect(getThreadExecutionOverride(harness.db, thread.id)).toEqual({
        modelOverride: "claude-fable-5",
        reasoningLevelOverride: null,
      });
      expect(
        responder.requests.filter(
          ({ command }) => command.type === "provider.list_models",
        ),
      ).toHaveLength(2);
    });
  });

  it("rejects a token that expires while the fresh catalog is loading", async () => {
    await withTestHarness(async (harness) => {
      const { host, session } = seedHostSession(harness.deps, {
        id: "host-execution-batch-expiry",
      });
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
        path: "/tmp/thread-execution-batch-expiry",
      });
      const environment = seedEnvironment(harness.deps, {
        hostId: host.id,
        projectId: project.id,
        path: "/tmp/thread-execution-batch-expiry",
      });
      const thread = seedThread(harness.deps, {
        environmentId: environment.id,
        projectId: project.id,
        providerId: "claude-code",
      });
      setThreadExecutionOverride(harness.db, {
        threadId: thread.id,
        modelOverride: "claude-fable-5",
      });
      const now = 1_800_000_000_000;
      vi.useFakeTimers();
      vi.setSystemTime(now);
      let catalogLoads = 0;
      registerHostRpcResponder(harness, {
        hostId: host.id,
        sessionId: session.id,
        handle: (request) => {
          if (request.command.type !== "provider.list_models") {
            throw new Error(`Unexpected RPC command ${request.command.type}`);
          }
          catalogLoads += 1;
          if (catalogLoads === 2) vi.setSystemTime(now + 5 * 60 * 1_000);
          return {
            ok: true,
            result: {
              models: [
                availableModelFixture({ model: "claude-fable-5" }),
                availableModelFixture({ model: "claude-opus-5" }),
              ],
              selectedOnlyModels: [],
            },
          };
        },
      });
      try {
        const current = executeThreadFacetQuery(harness.deps, {
          actor: null,
          request: {
            scope: { projectId: project.id },
            filters: [],
            pageSize: 10,
            experimental_includeExecution: true,
          },
        }).threads[0]?.experimental_execution;
        if (!current) throw new Error("Expected execution projection");
        const preflight = await preflightThreadExecutionOverrides(
          harness.deps,
          {
            items: [
              {
                threadId: thread.id,
                witness: current.witness,
                patch: { model: "claude-opus-5" },
              },
            ],
          },
        );
        const ready = preflight.results[0];
        if (ready?.status !== "ready") throw new Error("Expected ready result");

        const applied = await applyPreflightedThreadExecutionOverrides(
          harness.deps,
          { items: [{ threadId: thread.id, applyToken: ready.applyToken }] },
        );

        expect(applied.results).toEqual([
          {
            status: "rejected",
            threadId: thread.id,
            reason: "invalid-token",
            retryable: false,
          },
        ]);
        expect(getThreadExecutionOverride(harness.db, thread.id)).toEqual({
          modelOverride: "claude-fable-5",
          reasoningLevelOverride: null,
        });
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("keeps a missing primary-host route local to its thread", async () => {
    await withTestHarness(async (harness) => {
      const { host, session } = seedHostSession(harness.deps, {
        id: "host-execution-batch-disconnected",
      });
      harness.hub.unregisterDaemon(session.id);
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
        path: "/tmp/thread-execution-batch-no-primary",
      });
      const thread = seedThread(harness.deps, {
        projectId: project.id,
        providerId: "claude-code",
      });
      const current = executeThreadFacetQuery(harness.deps, {
        actor: null,
        request: {
          scope: { projectId: project.id },
          filters: [],
          pageSize: 10,
          experimental_includeExecution: true,
        },
      }).threads[0]?.experimental_execution;
      if (!current) throw new Error("Expected execution projection");

      await expect(
        preflightThreadExecutionOverrides(harness.deps, {
          items: [
            {
              threadId: thread.id,
              witness: current.witness,
              patch: { model: "claude-opus-5" },
            },
          ],
        }),
      ).resolves.toMatchObject({
        results: [
          {
            status: "unavailable",
            threadId: thread.id,
            reason: "catalog-unavailable",
          },
        ],
      });
    });
  });

  it("rejects more than 100 unique catalog routes without probing providers", async () => {
    await withTestHarness(async (harness) => {
      const { host, session } = seedHostSession(harness.deps, {
        id: "host-execution-batch-route-limit",
      });
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
        path: "/tmp/thread-execution-batch-route-limit",
      });
      upsertProjectExecutionDefaults(harness.db, {
        projectId: project.id,
        providerId: "pi",
        model: "anthropic/claude-opus-5",
        reasoningLevel: "medium",
        permissionMode: "full",
        serviceTier: "default",
      });
      const threads = Array.from({ length: 101 }, (_, index) => {
        const environment = seedEnvironment(harness.deps, {
          hostId: host.id,
          projectId: project.id,
          path: `/tmp/thread-execution-batch-route-limit/${index}`,
          status: "ready",
        });
        return seedThread(harness.deps, {
          environmentId: environment.id,
          projectId: project.id,
          providerId: "pi",
          title: `Route ${index}`,
        });
      });
      const responder = registerProviderHostRpcResponder(harness, {
        hostId: host.id,
        sessionId: session.id,
        modelsByProviderId: {
          pi: {
            models: [
              availableModelFixture({ model: "anthropic/claude-opus-5" }),
            ],
            selectedOnlyModels: [],
          },
        },
      });
      const rows = listThreadExecutionProjectionRowsByIds(
        harness.db,
        threads.map(({ id }) => id),
      );
      const summaries = buildThreadExecutionProjection(
        harness.deps,
        rows.map((row) => ({
          environmentId: row.environmentId,
          environmentUpdatedAt: row.environmentUpdatedAt,
          executionRevision: row.executionRevision,
          hostId: row.hostId,
          id: row.threadId,
          path: row.path,
          projectId: row.projectId,
          providerId: row.providerId,
        })),
      );

      const preflight = await preflightThreadExecutionOverrides(harness.deps, {
        items: threads.map(({ id }) => ({
          threadId: id,
          witness: summaries.get(id)?.witness ?? "",
          patch: { model: "anthropic/claude-opus-5" },
        })),
      });

      expect(preflight.results).toHaveLength(101);
      expect(
        preflight.results.every(
          (result) =>
            result.status === "unavailable" &&
            result.reason === "catalog-unavailable",
        ),
      ).toBe(true);
      expect(
        responder.requests.filter(
          ({ command }) => command.type === "provider.list_models",
        ),
      ).toHaveLength(0);
    });
  });
});
