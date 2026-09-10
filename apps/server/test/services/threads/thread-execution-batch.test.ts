import { getThreadExecutionOverride, setThreadExecutionOverride } from "@bb/db";
import { describe, expect, it, vi } from "vitest";
import {
  applyPreflightedThreadExecutionOverrides,
  preflightThreadExecutionOverrides,
} from "../../../src/services/threads/thread-execution-batch.js";
import { executeThreadFacetQuery } from "../../../src/services/threads/thread-facet-query.js";
import { availableModelFixture } from "../../helpers/available-models.js";
import { registerHostRpcResponder } from "../../helpers/host-rpc.js";
import {
  seedEnvironment,
  seedHostSession,
  seedProjectWithSource,
  seedThread,
} from "../../helpers/seed.js";
import { withTestHarness } from "../../helpers/test-app.js";

describe("thread execution override batches", () => {
  it("rejects a token that expires while the fresh catalog is loading", async () => {
    await withTestHarness(async (harness) => {
      const { host, session } = seedHostSession(harness.deps, { id: "host-execution-expiry" });
      const { project } = seedProjectWithSource(harness.deps, { hostId: host.id, path: "/tmp/thread-execution-expiry" });
      const environment = seedEnvironment(harness.deps, { hostId: host.id, projectId: project.id, path: "/tmp/thread-execution-expiry" });
      const thread = seedThread(harness.deps, { environmentId: environment.id, projectId: project.id, providerId: "claude-code" });
      setThreadExecutionOverride(harness.db, { threadId: thread.id, modelOverride: "claude-fable-5" });
      const now = 1_800_000_000_000;
      vi.useFakeTimers();
      vi.setSystemTime(now);
      let catalogLoads = 0;
      registerHostRpcResponder(harness, {
        hostId: host.id,
        sessionId: session.id,
        handle: (request) => {
          if (request.command.type !== "provider.list_models") throw new Error("unexpected RPC");
          catalogLoads += 1;
          if (catalogLoads === 2) vi.setSystemTime(now + 5 * 60 * 1_000);
          return { ok: true, result: { models: [availableModelFixture({ model: "claude-fable-5" }), availableModelFixture({ model: "claude-opus-5" })], selectedOnlyModels: [] } };
        },
      });
      try {
        const current = executeThreadFacetQuery(harness.deps, { request: { scope: { projectId: project.id }, filters: [], pageSize: 10, experimental_includeExecution: true } }).threads[0]?.experimental_execution;
        if (!current) throw new Error("Expected execution projection");
        const preflight = await preflightThreadExecutionOverrides(harness.deps, { items: [{ threadId: thread.id, witness: current.witness, patch: { model: "claude-opus-5" } }] });
        const ready = preflight.results[0];
        if (ready?.status !== "ready") throw new Error("Expected ready result");
        const applied = await applyPreflightedThreadExecutionOverrides(harness.deps, { items: [{ threadId: thread.id, applyToken: ready.applyToken }] });
        expect(applied.results).toEqual([{ status: "rejected", threadId: thread.id, reason: "invalid-token", retryable: false }]);
        expect(getThreadExecutionOverride(harness.db, thread.id)).toEqual({ modelOverride: "claude-fable-5", reasoningLevelOverride: null });
        expect(catalogLoads).toBe(2);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("rejects a token when provider registration changes during fresh catalog loading", async () => {
    await withTestHarness(async (harness) => {
      const { host, session } = seedHostSession(harness.deps, { id: "host-execution-generation" });
      const { project } = seedProjectWithSource(harness.deps, { hostId: host.id, path: "/tmp/thread-execution-generation" });
      const environment = seedEnvironment(harness.deps, { hostId: host.id, projectId: project.id, path: "/tmp/thread-execution-generation" });
      const thread = seedThread(harness.deps, { environmentId: environment.id, projectId: project.id, providerId: "claude-code" });
      setThreadExecutionOverride(harness.db, { threadId: thread.id, modelOverride: "claude-fable-5" });
      let revision = harness.deps.providerRegistry.getRegistrationRevision();
      vi.spyOn(harness.deps.providerRegistry, "getRegistrationRevision").mockImplementation(() => revision);
      let catalogLoads = 0;
      registerHostRpcResponder(harness, {
        hostId: host.id,
        sessionId: session.id,
        handle: (request) => {
          if (request.command.type !== "provider.list_models") throw new Error("unexpected RPC");
          catalogLoads += 1;
          if (catalogLoads === 2) revision += 1;
          return { ok: true, result: { models: [availableModelFixture({ model: "claude-fable-5" }), availableModelFixture({ model: "claude-opus-5" })], selectedOnlyModels: [] } };
        },
      });
      const current = executeThreadFacetQuery(harness.deps, { request: { scope: { projectId: project.id }, filters: [], pageSize: 10, experimental_includeExecution: true } }).threads[0]?.experimental_execution;
      if (!current) throw new Error("Expected execution projection");
      const preflight = await preflightThreadExecutionOverrides(harness.deps, { items: [{ threadId: thread.id, witness: current.witness, patch: { model: "claude-opus-5" } }] });
      const ready = preflight.results[0];
      if (ready?.status !== "ready") throw new Error("Expected ready result");
      const applied = await applyPreflightedThreadExecutionOverrides(harness.deps, { items: [{ threadId: thread.id, applyToken: ready.applyToken }] });
      expect(applied.results).toEqual([{ status: "rejected", threadId: thread.id, reason: "catalog-changed", retryable: true }]);
      expect(getThreadExecutionOverride(harness.db, thread.id)).toEqual({ modelOverride: "claude-fable-5", reasoningLevelOverride: null });
      expect(catalogLoads).toBe(2);
    });
  });

  it("rejects a retired model from the same host session during fresh apply", async () => {
    await withTestHarness(async (harness) => {
      const { host, session } = seedHostSession(harness.deps, { id: "host-execution-retirement" });
      const { project } = seedProjectWithSource(harness.deps, { hostId: host.id, path: "/tmp/thread-execution-retirement" });
      const environment = seedEnvironment(harness.deps, { hostId: host.id, projectId: project.id, path: "/tmp/thread-execution-retirement" });
      const thread = seedThread(harness.deps, { environmentId: environment.id, projectId: project.id, providerId: "claude-code" });
      setThreadExecutionOverride(harness.db, { threadId: thread.id, modelOverride: "claude-fable-5" });
      let models = [availableModelFixture({ model: "claude-fable-5" }), availableModelFixture({ model: "claude-opus-5" })];
      let catalogLoads = 0;
      registerHostRpcResponder(harness, {
        hostId: host.id,
        sessionId: session.id,
        handle: (request) => {
          if (request.command.type !== "provider.list_models") throw new Error("unexpected RPC");
          catalogLoads += 1;
          return { ok: true, result: { models, selectedOnlyModels: [] } };
        },
      });
      const current = executeThreadFacetQuery(harness.deps, { request: { scope: { projectId: project.id }, filters: [], pageSize: 10, experimental_includeExecution: true } }).threads[0]?.experimental_execution;
      if (!current) throw new Error("Expected execution projection");
      const preflight = await preflightThreadExecutionOverrides(harness.deps, { items: [{ threadId: thread.id, witness: current.witness, patch: { model: "claude-opus-5" } }] });
      const ready = preflight.results[0];
      if (ready?.status !== "ready") throw new Error("Expected ready result");
      models = [availableModelFixture({ model: "claude-fable-5" })];
      const applied = await applyPreflightedThreadExecutionOverrides(harness.deps, { items: [{ threadId: thread.id, applyToken: ready.applyToken }] });
      expect(applied.results).toEqual([{ status: "rejected", threadId: thread.id, reason: "catalog-changed", retryable: true }]);
      expect(getThreadExecutionOverride(harness.db, thread.id)).toEqual({ modelOverride: "claude-fable-5", reasoningLevelOverride: null });
      expect(catalogLoads).toBe(2);
    });
  });
});
