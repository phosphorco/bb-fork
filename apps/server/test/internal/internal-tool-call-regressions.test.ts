import { eq } from "drizzle-orm";
import { events } from "@bb/db";
import { describe, expect, it } from "vitest";
import { getServerP6rToolCorrelationRegistry } from "../../src/services/p6r/tool-correlation-registry.js";
import { setPluginAgentContributions } from "../../src/services/plugins/plugin-agent-contributions.js";
import type { PluginAgentToolRecord } from "../../src/services/plugins/plugin-api.js";
import { internalAuthHeaders } from "../helpers/commands.js";
import { readJson } from "../helpers/json.js";
import {
  seedEnvironment,
  seedHostSession,
  seedProjectWithSource,
  seedThread,
} from "../helpers/seed.js";
import { withTestHarness } from "../helpers/test-app.js";

describe("internal tool-call regressions", () => {
  it("issues native correlation only to the admitted plugin tool context", async () => {
    await withTestHarness(async (harness) => {
      const session = seedHostSession(harness.deps, { id: "host-tool-admitted" });
      const { project } = seedProjectWithSource(harness.deps, { hostId: session.host.id });
      const environment = seedEnvironment(harness.deps, { hostId: session.host.id, projectId: project.id });
      const thread = seedThread(harness.deps, { environmentId: environment.id, projectId: project.id });
      const call = {
        callId: "call-admitted",
        providerThreadId: "provider-admitted",
        sessionId: session.session.id,
        threadId: thread.id,
        turnId: "turn-admitted",
      };
      let admittedContext: object | null = null;
      const record: PluginAgentToolRecord = {
        name: "admitted_tool",
        description: "fixture",
        instructions: null,
        presentation: null,
        inputSchema: {},
        parse: (input) => ({ ok: true, value: input }),
        execute: () => "unused",
      };
      setPluginAgentContributions({
        findAgentTool: (name) => name === "admitted_tool" ? { pluginId: "fixture", record } : undefined,
        invokeAgentTool: async (input) => {
          admittedContext = input.ctx;
          return { success: true, contentItems: [{ type: "inputText", text: "ok" }] };
        },
        listAgentTools: () => [],
        listInstructionContributions: () => [],
        listSkillRootContributions: () => [],
        resolveMention: async () => ({ ok: false, error: "unused" }),
      });
      try {
        const response = await harness.app.request("/internal/session/tool-call", {
          method: "POST",
          headers: internalAuthHeaders(harness),
          body: JSON.stringify({ ...call, tool: "admitted_tool" }),
        });
        expect(response.status).toBe(200);
        if (admittedContext === null) throw new Error("Expected admitted tool context");
        expect(getServerP6rToolCorrelationRegistry().lookupContext(admittedContext)).toEqual(call);
        expect(getServerP6rToolCorrelationRegistry().lookupContext({})).toBeNull();
      } finally {
        setPluginAgentContributions(undefined);
      }
    });
  });

  it("binds unsupported native tool calls to their exact daemon identifiers", async () => {
    await withTestHarness(async (harness) => {
      const session = seedHostSession(harness.deps, { id: "host-tool-p6r" });
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: session.host.id,
      });
      const environment = seedEnvironment(harness.deps, {
        hostId: session.host.id,
        projectId: project.id,
      });
      const thread = seedThread(harness.deps, {
        projectId: project.id,
        environmentId: environment.id,
      });
      const call = {
        sessionId: session.session.id,
        threadId: thread.id,
        providerThreadId: "provider-p6r",
        turnId: "turn-p6r",
        callId: "call-p6r",
      };

      const response = await harness.app.request("/internal/session/tool-call", {
        method: "POST",
        headers: internalAuthHeaders(harness),
        body: JSON.stringify({
          ...call,
          tool: "p6r_unsupported_tool",
        }),
      });

      expect(response.status).toBe(200);
      expect(getServerP6rToolCorrelationRegistry().lookup(call)).toMatchObject({
        call,
        outcome: "unsupported",
        status: "settled",
      });
    });
  });

  it("rejects tool calls for threads owned by a different host", async () => {
    await withTestHarness(async (harness) => {
      const hostA = seedHostSession(harness.deps, { id: "host-tool-a" });
      const hostB = seedHostSession(harness.deps, { id: "host-tool-b" });
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: hostB.host.id,
      });
      const environment = seedEnvironment(harness.deps, {
        hostId: hostB.host.id,
        projectId: project.id,
      });
      const thread = seedThread(harness.deps, {
        projectId: project.id,
        environmentId: environment.id,
      });

      const response = await harness.app.request(
        "/internal/session/tool-call",
        {
          method: "POST",
          headers: internalAuthHeaders(harness),
          body: JSON.stringify({
            sessionId: hostA.session.id,
            threadId: thread.id,
            providerThreadId: "provider-cross-host",
            turnId: "turn-cross-host",
            callId: "call-cross-host",
            tool: "message_user",
            arguments: {
              text: "Should be rejected",
            },
          }),
        },
      );

      expect(response.status).toBe(403);
      await expect(readJson(response)).resolves.toMatchObject({
        code: "invalid_request",
      });
      expect(
        harness.db
          .select()
          .from(events)
          .where(eq(events.threadId, thread.id))
          .all(),
      ).toHaveLength(0);
    });
  });
});
