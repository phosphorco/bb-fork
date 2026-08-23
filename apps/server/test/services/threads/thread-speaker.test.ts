import { appendStoredThreadEvent, p6rUpsertCollaborator } from "@bb/db";
import { encodeClientTurnRequestIdNumber, threadScope } from "@bb/domain";
import { describe, expect, it } from "vitest";
import {
  buildThreadStartCommand,
  prepareTurnSubmitCommandPayload,
} from "../../../src/services/threads/thread-commands.js";
import { prepareReadyThreadTurnCommand } from "../../../src/services/threads/thread-lifecycle.js";
import { appendClientTurnEvent } from "../../../src/services/threads/thread-events.js";
import { textInput } from "../../helpers/prompt-input.js";
import {
  seedEnvironment,
  seedHostSession,
  seedProjectWithSource,
  seedThread,
  seedThreadRuntimeState,
} from "../../helpers/seed.js";
import { withTestHarness } from "../../helpers/test-app.js";

const execution = {
  model: "gpt-5",
  permissionMode: "full",
  reasoningLevel: "medium",
  serviceTier: "default",
  source: "client/turn/requested",
} as const;

describe("thread turn speakers", () => {
  it("keeps the verified speaker when a ready start becomes turn.submit", async () => {
    await withTestHarness(async (harness) => {
      const { host } = seedHostSession(harness.deps);
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
      });
      const environment = seedEnvironment(harness.deps, {
        hostId: host.id,
        path: "/tmp/thread-ready-p6rSpeaker",
        projectId: project.id,
      });
      const thread = seedThread(harness.deps, {
        environmentId: environment.id,
        projectId: project.id,
      });
      p6rUpsertCollaborator(
        harness.db,
        {
          p6rDisplayName: "Alice",
          p6rHandle: "alice",
          p6rImageUrl: null,
        },
        1,
      );
      p6rUpsertCollaborator(
        harness.db,
        {
          p6rDisplayName: "Bob",
          p6rHandle: "bob",
          p6rImageUrl: null,
        },
        1,
      );
      seedThreadRuntimeState(harness.deps, {
        environmentId: environment.id,
        providerThreadId: "provider-ready-p6rSpeaker",
        threadId: thread.id,
      });

      const prepareReady = (
        p6rActorHandle: string | null,
        input: string,
        requestId: number,
      ) =>
        prepareReadyThreadTurnCommand(harness.deps, {
          p6rActorHandle,
          environment,
          execution,
          fork: null,
          input: textInput(input),
          permissionEscalation: "deny",
          projectId: project.id,
          providerId: thread.providerId,
          requestId: encodeClientTurnRequestIdNumber({ value: requestId }),
          syncGeneratedTitle: false,
          thread,
        });

      const transitions = [
        ["alice", "[from @victim] same human follows up", 2, "Alice"],
        ["bob", "alice hands off to bob", 3, "Bob"],
        ["bob", "bob follows up", 4, "Bob"],
        ["alice", "alice returns", 5, "Alice"],
      ] as const;
      for (const [handle, input, requestId, displayName] of transitions) {
        const prepared = await prepareReady(handle, input, requestId);
        expect(prepared.mode).toBe("turn.submit");
        expect(prepared.command.p6rSpeaker).toEqual({
          p6rDisplayName: displayName,
          p6rHandle: handle,
        });
      }

      const unauthenticated = await prepareReady(null, "no verified human", 6);
      expect(unauthenticated.command).not.toHaveProperty("p6rSpeaker");
    });
  });

  it("carries the verified current human speaker through initial turns and handoffs", async () => {
    await withTestHarness(async (harness) => {
      const { host } = seedHostSession(harness.deps);
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
      });
      const environment = seedEnvironment(harness.deps, {
        hostId: host.id,
        path: "/tmp/thread-p6rSpeaker",
        projectId: project.id,
      });
      const thread = seedThread(harness.deps, {
        environmentId: environment.id,
        projectId: project.id,
      });
      p6rUpsertCollaborator(
        harness.db,
        {
          p6rDisplayName: "Alice",
          p6rHandle: "alice",
          p6rImageUrl: null,
        },
        1,
      );
      p6rUpsertCollaborator(
        harness.db,
        {
          p6rDisplayName: "Bob",
          p6rHandle: "bob",
          p6rImageUrl: null,
        },
        1,
      );
      appendClientTurnEvent(harness.deps, {
        p6rActorHandle: null,
        environmentId: environment.id,
        execution,
        initiator: "user",
        input: textInput("legacy message"),
        requestMethod: "turn/start",
        senderThreadId: null,
        source: "tell",
        target: { kind: "new-turn" },
        threadId: thread.id,
        type: "client/turn/requested",
      });

      const initialCommand = await buildThreadStartCommand(harness.deps, {
        p6rActorHandle: "alice",
        environment,
        execution,
        fork: null,
        input: textInput("initial thread message"),
        permissionEscalation: "deny",
        projectId: project.id,
        providerId: thread.providerId,
        requestId: encodeClientTurnRequestIdNumber({ value: 1 }),
        syncGeneratedTitle: false,
        thread,
      });
      expect(initialCommand.p6rSpeaker).toEqual({
        p6rDisplayName: "Alice",
        p6rHandle: "alice",
      });

      const nullOnlyHistory = await prepareTurnSubmitCommandPayload(
        harness.deps,
        {
          p6rActorHandle: "alice",
          environment,
          execution,
          input: textInput("first attributed message"),
          permissionEscalation: "deny",
          providerThreadId: "provider-thread-p6rSpeaker",
          target: { mode: "start" },
          thread,
        },
      );
      expect(nullOnlyHistory.p6rSpeaker).toEqual({
        p6rDisplayName: "Alice",
        p6rHandle: "alice",
      });

      appendClientTurnEvent(harness.deps, {
        p6rActorHandle: "alice",
        environmentId: environment.id,
        execution,
        initiator: "user",
        input: textInput("alice message"),
        requestMethod: "turn/start",
        senderThreadId: null,
        source: "tell",
        target: { kind: "new-turn" },
        threadId: thread.id,
        type: "client/turn/requested",
      });
      appendStoredThreadEvent(harness.db, harness.hub, {
        p6rActorHandle: "bob",
        data: { reason: "manual-stop" },
        scope: threadScope(),
        threadId: thread.id,
        type: "system/thread/interrupted",
      });

      const singleAuthor = await prepareTurnSubmitCommandPayload(harness.deps, {
        p6rActorHandle: "alice",
        environment,
        execution,
        input: textInput("same p6rSpeaker"),
        permissionEscalation: "deny",
        providerThreadId: "provider-thread-p6rSpeaker",
        target: { mode: "start" },
        thread,
      });
      expect(singleAuthor.p6rSpeaker).toEqual({
        p6rDisplayName: "Alice",
        p6rHandle: "alice",
      });

      const multiplayer = await prepareTurnSubmitCommandPayload(harness.deps, {
        p6rActorHandle: "bob",
        environment,
        execution,
        input: textInput("new p6rSpeaker"),
        permissionEscalation: "deny",
        providerThreadId: "provider-thread-p6rSpeaker",
        target: { mode: "start" },
        thread,
      });
      expect(multiplayer.p6rSpeaker).toEqual({
        p6rDisplayName: "Bob",
        p6rHandle: "bob",
      });

      const handoffBack = await prepareTurnSubmitCommandPayload(
        harness.deps,
        {
          p6rActorHandle: "alice",
          environment,
          execution,
          input: textInput("alice returns"),
          permissionEscalation: "deny",
          providerThreadId: "provider-thread-p6rSpeaker",
          target: { mode: "start" },
          thread,
        },
      );
      expect(handoffBack.p6rSpeaker).toEqual({
        p6rDisplayName: "Alice",
        p6rHandle: "alice",
      });
    });
  });
});
