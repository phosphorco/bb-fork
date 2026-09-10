import {
  createConnection,
  listEvents,
  listQueuedThreadMessages,
  migrate,
  setThreadExecutionOverride,
  setThreadPendingStartContext,
} from "@bb/db";
import type { Thread } from "@bb/domain";
import { describe, expect, it } from "vitest";
import { createP6rNativeAcceptance } from "../../../src/services/p6r/native-acceptance.js";
import { setPluginHookProvider } from "../../../src/services/plugins/plugin-hook-registry.js";
import { applyLoggedThreadLifecycleEvent } from "../../../src/services/threads/lifecycle-outcome.js";
import { clearQueuedMessageWait } from "../../../src/services/threads/queue-waits.js";
import { sendNextQueuedMessageIfPresent } from "../../../src/services/threads/queued-messages.js";
import { migrateP6rSidecars } from "../../../src/services/p6r/sidecar-migrate.js";
import { lookupP6rOperationReceipt } from "../../../src/services/p6r/sidecar-store.js";
import { listQueuedThreadCommands } from "../../helpers/commands.js";
import {
  configuredAcpProvider,
  stubHostArtifact,
} from "../../helpers/provider-registry.js";
import {
  seedEnvironment,
  seedHostSession,
  seedProjectWithSource,
  seedThread,
  seedThreadRuntimeState,
} from "../../helpers/seed.js";
import { withTestHarness } from "../../helpers/test-app.js";

function database() {
  const db = createConnection(":memory:");
  migrate(db);
  migrateP6rSidecars(db);
  return db;
}

function thread(): Thread {
  return {
    archivedAt: null, createdAt: 1, deletedAt: null, environmentId: null, id: "thread-1", lastReadAt: null,
    latestAttentionAt: 1, originKind: null, originPluginId: null, parentThreadId: null, pinnedAt: null,
    projectId: "project-1", providerId: "provider-1", sectionId: null, sourceThreadId: null, status: "idle",
    title: null, titleFallback: null, updatedAt: 1, visibility: "visible",
  };
}

function acceptance() {
  return {
    authorEvidence: { evidence: "integration-asserted", identity: { key: "external-key", kind: "external", pluginId: "plugin-1", subject: "author-1" }, presentation: { avatarUrl: null, displayName: "Author", handle: null } },
    input: { input: [{ mentions: [], text: "hello", type: "text" }], mode: "start" as const, operationId: "operation-1", threadId: "thread-1" },
    operationNamespace: "instance-1:plugin-1",
    payloadHash: "payload-hash",
    source: "external" as const,
    validate: () => ({ ok: true } as const),
  };
}

describe("P6r native acceptance", () => {
  it("leaves a pending cold start un-attributed while ordinary dispatch waits", async () => {
    await withTestHarness(async (harness) => {
      const { host } = seedHostSession(harness.deps, { id: "p6r-pending-wait-host" });
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
        path: "/tmp/p6r-pending-wait",
      });
      const thread = seedThread(harness.deps, {
        projectId: project.id,
        status: "pending",
      });
      setThreadExecutionOverride(harness.db, {
        modelOverride: "gpt-5",
        threadId: thread.id,
      });
      setThreadPendingStartContext(harness.db, {
        threadId: thread.id,
        pendingStartContext: JSON.stringify({
          environmentIntent: {
            hostId: host.id,
            path: "/tmp/p6r-pending-wait",
            type: "direct-unmanaged",
          },
          fork: null,
          startedOnBehalfOf: null,
          titleProvided: false,
        }),
      });
      setPluginHookProvider({
        decisionTimeoutMs: 10_000,
        invokeHook: async (_pluginId, _label, run) => ({ ok: true, value: await run() }),
        listHooks: () => [{
          handler: () => ({ action: "wait", reason: "capacity" }),
          pluginId: "p6r-wait-fixture",
        }],
      });
      try {
        const accept = createP6rNativeAcceptance({
          deps: harness.deps,
          now: () => 100,
          retentionMs: 1_000,
        });
        const operation = {
          ...acceptance(),
          input: {
            ...acceptance().input,
            operationId: "pending-wait-operation",
            threadId: thread.id,
          },
          operationNamespace: "pending-wait:plugin-1",
          payloadHash: "pending-wait-hash",
        };
        await expect(accept(operation)).resolves.toMatchObject({
          operationId: "pending-wait-operation",
          status: "indeterminate",
        });
        expect(lookupP6rOperationReceipt(
          harness.db,
          "pending-wait:plugin-1",
          "pending-wait-operation",
        )).toMatchObject({ status: "pending" });
        expect(listQueuedThreadMessages(harness.db, thread.id)).toHaveLength(1);
        const afterRestart = createP6rNativeAcceptance({
          deps: harness.deps,
          now: () => 101,
          retentionMs: 1_000,
        });
        await expect(afterRestart(operation)).resolves.toMatchObject({
          operationId: "pending-wait-operation",
          status: "indeterminate",
        });
        const [reserved] = listQueuedThreadMessages(harness.db, thread.id);
        if (!reserved) throw new Error("Expected pending P6r queue reservation");
        clearQueuedMessageWait(harness.deps, {
          queuedMessageId: reserved.id,
          threadId: thread.id,
        });
        await expect(sendNextQueuedMessageIfPresent(harness.deps, {
          threadId: thread.id,
        })).resolves.toBe(true);
        expect(listQueuedThreadMessages(harness.db, thread.id)).toMatchObject([
          { id: reserved.id },
        ]);
        expect(
          listEvents(harness.db, { threadId: thread.id }).filter(
            (event) => event.type === "client/turn/requested",
          ),
        ).toHaveLength(0);
        setPluginHookProvider(undefined);
        clearQueuedMessageWait(harness.deps, {
          queuedMessageId: reserved.id,
          threadId: thread.id,
        });
        await expect(sendNextQueuedMessageIfPresent(harness.deps, {
          threadId: thread.id,
        })).resolves.toBe(true);
        expect(lookupP6rOperationReceipt(
          harness.db,
          "pending-wait:plugin-1",
          "pending-wait-operation",
        )).toMatchObject({ status: "accepted" });
        await expect(afterRestart(operation)).resolves.toMatchObject({
          receipt: { operationId: "pending-wait-operation" },
          status: "submitted",
        });
      } finally {
        setPluginHookProvider(undefined);
      }
    });
  });

  it("makes explicit queued-operation cancellation final before a same-operation retry", async () => {
    await withTestHarness(async (harness) => {
      const { host } = seedHostSession(harness.deps, { id: "p6r-pending-cancel-host" });
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
        path: "/tmp/p6r-pending-cancel",
      });
      const thread = seedThread(harness.deps, {
        projectId: project.id,
        status: "pending",
      });
      setThreadExecutionOverride(harness.db, {
        modelOverride: "gpt-5",
        threadId: thread.id,
      });
      setThreadPendingStartContext(harness.db, {
        threadId: thread.id,
        pendingStartContext: JSON.stringify({
          environmentIntent: {
            hostId: host.id,
            path: "/tmp/p6r-pending-cancel",
            type: "direct-unmanaged",
          },
          fork: null,
          startedOnBehalfOf: null,
          titleProvided: false,
        }),
      });
      setPluginHookProvider({
        decisionTimeoutMs: 10_000,
        invokeHook: async (_pluginId, _label, run) => ({ ok: true, value: await run() }),
        listHooks: () => [{
          handler: () => ({ action: "wait", reason: "capacity" }),
          pluginId: "p6r-cancel-fixture",
        }],
      });
      try {
        const accept = createP6rNativeAcceptance({
          deps: harness.deps,
          now: () => 100,
          retentionMs: 1_000,
        });
        const operation = {
          ...acceptance(),
          input: {
            ...acceptance().input,
            operationId: "pending-cancel-operation",
            threadId: thread.id,
          },
          operationNamespace: "pending-cancel:plugin-1",
          payloadHash: "pending-cancel-hash",
        };
        await expect(accept(operation)).resolves.toMatchObject({
          operationId: "pending-cancel-operation",
          status: "indeterminate",
        });
        const [queued] = listQueuedThreadMessages(harness.db, thread.id);
        if (!queued) throw new Error("Expected pending P6r queue reservation");
        const edited = await harness.app.request(
          `/api/v1/threads/${thread.id}/queued-messages/${queued.id}`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              expectedUpdatedAt: queued.updatedAt,
              input: [{ mentions: [], text: "changed", type: "text" }],
            }),
          },
        );
        expect(edited.status).toBe(409);
        const response = await harness.app.request(
          `/api/v1/threads/${thread.id}/queued-messages/${queued.id}`,
          { method: "DELETE" },
        );
        expect(response.status).toBe(200);
        expect(listQueuedThreadMessages(harness.db, thread.id)).toEqual([]);
        expect(lookupP6rOperationReceipt(
          harness.db,
          "pending-cancel:plugin-1",
          "pending-cancel-operation",
        )).toMatchObject({ status: "rejected" });
        await expect(accept(operation)).resolves.toMatchObject({
          error: { code: "cancelled", retry: "never" },
          status: "rejected",
        });
        await expect(sendNextQueuedMessageIfPresent(harness.deps, {
          threadId: thread.id,
        })).resolves.toBe(false);
      } finally {
        setPluginHookProvider(undefined);
      }
    });
  });

  it("rolls back a pending cold-start receipt when admission loses its thread", async () => {
    await withTestHarness(async (harness) => {
      const { host } = seedHostSession(harness.deps, { id: "p6r-pending-lost-host" });
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
        path: "/tmp/p6r-pending-lost",
      });
      const thread = seedThread(harness.deps, {
        projectId: project.id,
        status: "pending",
      });
      setThreadPendingStartContext(harness.db, {
        threadId: thread.id,
        pendingStartContext: JSON.stringify({
          environmentIntent: {
            hostId: host.id,
            path: "/tmp/p6r-pending-lost",
            type: "direct-unmanaged",
          },
          fork: null,
          startedOnBehalfOf: null,
          titleProvided: false,
        }),
      });
      setPluginHookProvider({
        decisionTimeoutMs: 10_000,
        invokeHook: async (_pluginId, _label, run) => ({ ok: true, value: await run() }),
        listHooks: () => [{
          handler: () => {
            applyLoggedThreadLifecycleEvent(harness.deps, {
              threadId: thread.id,
              event: { type: "run.preparing" },
            });
            return { action: "proceed" };
          },
          pluginId: "p6r-lost-fixture",
        }],
      });
      try {
        const accept = createP6rNativeAcceptance({
          deps: harness.deps,
          now: () => 100,
          retentionMs: 1_000,
        });
        await expect(accept({
          ...acceptance(),
          input: {
            ...acceptance().input,
            operationId: "pending-lost-operation",
            threadId: thread.id,
          },
          operationNamespace: "pending-lost:plugin-1",
          payloadHash: "pending-lost-hash",
        })).resolves.toMatchObject({
          error: { code: "unavailable" },
          status: "rejected",
        });
        expect(
          lookupP6rOperationReceipt(
            harness.db,
            "pending-lost:plugin-1",
            "pending-lost-operation",
          ),
        ).toBeNull();
        expect(
          listEvents(harness.db, { threadId: thread.id }).filter(
            (event) => event.type === "client/turn/requested",
          ),
        ).toHaveLength(0);
      } finally {
        setPluginHookProvider(undefined);
      }
    });
  });

  it("commits a pending cold-start request and P6r receipt exactly once", async () => {
    await withTestHarness(async (harness) => {
      const { host } = seedHostSession(harness.deps, { id: "p6r-pending-commit-host" });
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
        path: "/tmp/p6r-pending-commit",
      });
      const environment = seedEnvironment(harness.deps, {
        hostId: host.id,
        path: "/tmp/p6r-pending-commit",
        projectId: project.id,
        status: "ready",
      });
      const thread = seedThread(harness.deps, {
        environmentId: environment.id,
        projectId: project.id,
        status: "pending",
      });
      setThreadExecutionOverride(harness.db, {
        modelOverride: "gpt-5",
        threadId: thread.id,
      });
      setThreadPendingStartContext(harness.db, {
        threadId: thread.id,
        pendingStartContext: JSON.stringify({
          environmentIntent: { environmentId: environment.id, type: "reuse" },
          fork: null,
          startedOnBehalfOf: null,
          titleProvided: false,
        }),
      });
      const accept = createP6rNativeAcceptance({
        deps: harness.deps,
        now: () => 100,
        retentionMs: 1_000,
      });
      const input = {
        ...acceptance(),
        input: {
          ...acceptance().input,
          operationId: "pending-commit-operation",
          threadId: thread.id,
        },
        operationNamespace: "pending-commit:plugin-1",
        payloadHash: "pending-commit-hash",
      };
      const firstOutcome = await accept(input);
      if (firstOutcome.status !== "submitted") {
        throw new Error(
          firstOutcome.status === "rejected"
            ? firstOutcome.error.message
            : firstOutcome.message,
        );
      }
      expect(firstOutcome).toMatchObject({
        receipt: { operationId: "pending-commit-operation" },
        status: "submitted",
      });
      const receipt = lookupP6rOperationReceipt(
        harness.db,
        "pending-commit:plugin-1",
        "pending-commit-operation",
      );
      expect(receipt).toMatchObject({
        acceptedRequestSequence: expect.any(Number),
        nativeRequestId: expect.any(String),
        threadId: thread.id,
      });
      const requests = listEvents(harness.db, { threadId: thread.id }).filter(
        (event) => event.type === "client/turn/requested",
      );
      expect(requests).toHaveLength(1);
      const requestEvent = requests[0];
      if (
        requestEvent === undefined ||
        receipt === null ||
        receipt.nativeRequestId === null
      ) {
        throw new Error("Expected one retained native request ID");
      }
      expect(JSON.parse(requestEvent.data)).toMatchObject({
        requestId: receipt.nativeRequestId,
      });
      await expect(accept(input)).resolves.toMatchObject({
        receipt: { operationId: "pending-commit-operation" },
        status: "submitted",
      });
      expect(
        listEvents(harness.db, { threadId: thread.id }).filter(
          (event) => event.type === "client/turn/requested",
        ),
      ).toHaveLength(1);
    });
  });

  it.each(["auto", "start", "steer-if-active", "queue-if-active"] as const)("preserves %s and reconciles a committed receipt after postcommit dispatch failure", async (mode) => {
    const db = database();
    const accept = createP6rNativeAcceptance({
      db,
      findThread: () => thread(),
      now: () => 100,
      retentionMs: 1_000,
      dispatch: async (input) => {
        expect(input.payload.mode).toBe(mode);
        db.transaction((tx) => {
          input.beforeAppendInTransaction({ tx });
          input.afterAppendInTransaction({ inputGroups: [input.payload.input], request: { requestId: "native-request-1", sequence: 7 }, tx });
        });
        throw new Error("postcommit notification failed");
      },
    });
    await expect(accept({ ...acceptance(), input: { ...acceptance().input, mode } })).resolves.toMatchObject({ status: "submitted", receipt: { operationId: "operation-1" } });
    expect(lookupP6rOperationReceipt(db, "instance-1:plugin-1", "operation-1")).toMatchObject({ acceptedRequestSequence: 7, payloadHash: "payload-hash" });
  });

  it("does not reconcile a receipt when precommit dispatch rolls back", async () => {
    const db = database();
    const accept = createP6rNativeAcceptance({
      db,
      findThread: () => thread(),
      now: () => 100,
      retentionMs: 1_000,
      dispatch: async (input) => {
        db.transaction((tx) => {
          input.beforeAppendInTransaction({ tx });
          input.afterAppendInTransaction({ inputGroups: [input.payload.input], request: { requestId: "native-request-1", sequence: 7 }, tx });
          throw new Error("precommit append failed");
        });
      },
    });
    await expect(accept(acceptance())).resolves.toMatchObject({ status: "rejected" });
    expect(lookupP6rOperationReceipt(db, "instance-1:plugin-1", "operation-1")).toBeNull();
  });

  it("submits through real thread send with an offline ACP provider command port", async () => {
    await withTestHarness(
      {
        extraProviders: [
          await configuredAcpProvider({
            args: ["serve"],
            command: "offline-p6r-agent",
            displayName: "Offline P6r Agent",
            id: "offline-p6r",
            modelCli: {
              listArgs: ["models", "list"],
              primaryModels: ["offline-model"],
              selectFlag: "--model",
            },
          }),
        ],
        seedFirstPartyProviders: false,
      },
      async (harness) => {
        harness.deps.pluginHostArtifacts.set(
          "provider-acp",
          stubHostArtifact("provider-acp"),
        );
        const { host } = seedHostSession(harness.deps, {
          id: "p6r-native-offline-host",
        });
        const { project } = seedProjectWithSource(harness.deps, {
          hostId: host.id,
          path: "/tmp/p6r-native-offline",
        });
        const environment = seedEnvironment(harness.deps, {
          hostId: host.id,
          path: "/tmp/p6r-native-offline",
          projectId: project.id,
          status: "ready",
        });
        const thread = seedThread(harness.deps, {
          environmentId: environment.id,
          projectId: project.id,
          providerId: "acp-offline-p6r",
          status: "idle",
        });
        seedThreadRuntimeState(harness.deps, {
          environmentId: environment.id,
          providerThreadId: "offline-provider-thread",
          threadId: thread.id,
        });
        setThreadExecutionOverride(harness.db, {
          modelOverride: "offline-model",
          threadId: thread.id,
        });
        const accept = createP6rNativeAcceptance({
          deps: harness.deps,
          now: () => 100,
          retentionMs: 1_000,
        });

        const outcome = await accept({
          ...acceptance(),
          input: {
            ...acceptance().input,
            operationId: "offline-operation",
            threadId: thread.id,
          },
          operationNamespace: "offline-instance:plugin-1",
          payloadHash: "offline-payload-hash",
        });
        expect(outcome).toMatchObject({
          receipt: { operationId: "offline-operation" },
          status: "submitted",
        });
        const submitted = listQueuedThreadCommands(
          harness,
          "turn.submit",
          thread.id,
        );
        expect(submitted).toHaveLength(1);
        expect(submitted[0]).toMatchObject({
          resumeContext: { providerId: "acp-offline-p6r" },
          threadId: thread.id,
          type: "turn.submit",
        });
        expect(
          lookupP6rOperationReceipt(
            harness.db,
            "offline-instance:plugin-1",
            "offline-operation",
          ),
        ).toMatchObject({
          payloadHash: "offline-payload-hash",
          threadId: thread.id,
        });
      },
    );
  });
});
