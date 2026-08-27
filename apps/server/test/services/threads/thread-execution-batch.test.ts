import {
  getThreadExecutionOverride,
  setThreadExecutionOverride,
  updateThread,
} from "@bb/db";
import { describe, expect, it } from "vitest";
import {
  applyPreflightedThreadExecutionOverrides,
  preflightThreadExecutionOverrides,
} from "../../../src/services/threads/thread-execution-batch.js";
import { executeThreadFacetQuery } from "../../../src/services/threads/thread-facet-query.js";
import { availableModelFixture } from "../../helpers/available-models.js";
import { registerProviderHostRpcResponder } from "../../helpers/host-rpc.js";
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
      ).toHaveLength(1);
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
});
