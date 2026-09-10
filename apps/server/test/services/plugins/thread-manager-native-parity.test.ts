import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import {
  startTestServer,
  type RunningTestServer,
} from "../../helpers/test-app.js";
import { seedThreadFixture } from "../../helpers/seed.js";
import { p6rContributions } from "../../../src/services/p6r/sidecar-schema.js";
import { setThreadExecutionOverride, getThreadExecutionOverride } from "@bb/db";
import { z } from "zod";

let harness: RunningTestServer | undefined;
afterEach(async () => {
  await harness?.pluginService.stop();
  await harness?.close();
});

it(
  "runs the authored Thread Manager dashboard through candidate native SDK routes",
  { timeout: 60_000 },
  async () => {
    harness = await startTestServer();
    harness.pluginService.bindSdk({ baseUrl: harness.baseUrl });
    const { thread } = seedThreadFixture(harness, {
      thread: { title: "Native dashboard witness" },
    });
    const participants = Array.from({ length: 5 }, (_, index) => ({
      key: `p6r:fixture/${index}`,
      name: `Participant ${index}`,
    }));
    harness.db
      .insert(p6rContributions)
      .values(
        participants.map(({ key, name }, index) => {
          const actor = JSON.stringify({
            evidence: "provider-verified",
            identity: {
              kind: "person",
              key,
              issuer: "fixture",
              subject: String(index),
            },
            presentation: {
              displayName: name,
              handle: null,
              avatarUrl: `/avatars/${index}.png`,
            },
          });
          return {
            id: `dashboard-contribution-${index}`,
            threadId: thread.id,
            acceptedAt: index + 1,
            acceptedAuthorship: actor,
            initialInput: "[]",
            currentProjection: "[]",
            latestEditor: actor,
            nativeRequestId: null,
            copiedFromContributionId: null,
            replacesContributionId: null,
          };
        }),
      )
      .run();
    const root = join(harness.config.dataDir, "fixture-thread-manager");
    await mkdir(root);
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "bb-plugin-thread-manager",
        version: "0.1.0",
        type: "module",
        bb: {
          name: "Thread Manager",
          description: "Actual authored factory witness",
          branding: { icon: "List" },
          server: "./server.ts",
        },
      }),
    );
    const source = new URL(
      "../../../../../../../../plugins/plugins/thread-manager/server.ts",
      import.meta.url,
    ).href;
    await writeFile(
      join(root, "server.ts"),
      `export { default } from ${JSON.stringify(source)};\n`,
    );
    const installed = await harness.pluginService.installPath(root);
    expect(installed.status, JSON.stringify(installed)).toBe("running");
    const handler = harness.pluginService.getRpcHandler(
      "thread-manager",
      "dashboard",
    );
    if (handler.outcome !== "found")
      throw new Error("Missing actual dashboard handler");
    const result = await harness.pluginService.invokeRpcHandler(
      "thread-manager",
      "dashboard",
      handler.value,
      {
        sinceDays: null,
        projectId: null,
        archiveState: "active",
        errorQuery: "",
        includeErrorHistory: false,
        excludeParticipantKeys: [],
      },
      {
        ingress: { requestId: "native-dashboard-witness", transport: "http" },
        request: {},
      },
    );
    expect(result).toMatchObject({
      ok: true,
      result: {
        threads: expect.arrayContaining([
          expect.objectContaining({
            id: thread.id,
            title: "Native dashboard witness",
            participantNames: expect.arrayContaining(
              participants.map(({ name }) => name),
            ),
          }),
        ]),
        participants,
      },
    });
    const filtered = await harness.pluginService.invokeRpcHandler(
      "thread-manager",
      "dashboard",
      handler.value,
      {
        sinceDays: null,
        projectId: null,
        archiveState: "active",
        errorQuery: "",
        includeErrorHistory: false,
        excludeParticipantKeys: [participants[4]!.key],
      },
      {
        ingress: { requestId: "native-dashboard-filter", transport: "http" },
        request: {},
      },
    );
    expect(filtered).toMatchObject({
      ok: true,
      result: { threads: [], participants },
    });
    const invoke = async (method: string, input: unknown) => {
      const selected = harness!.pluginService.getRpcHandler(
        "thread-manager",
        method,
      );
      if (selected.outcome !== "found")
        throw new Error(`Missing actual ${method} handler`);
      return harness!.pluginService.invokeRpcHandler(
        "thread-manager",
        method,
        selected.value,
        input,
        {
          ingress: { requestId: `native-${method}`, transport: "http" },
          request: {},
        },
      );
    };
    const dashboardSchema = z.object({
      ok: z.literal(true),
      result: z.object({
        threads: z.array(
          z.object({
            id: z.string(),
            execution: z.object({ witness: z.string() }),
          }),
        ),
      }),
    });
    const witness = dashboardSchema
      .parse(result)
      .result.threads.find((row) => row.id === thread.id)!.execution.witness;
    const preflightSchema = z.object({
      ok: z.literal(true),
      result: z.object({
        results: z.array(
          z.object({ status: z.literal("ready"), applyToken: z.string() }),
        ),
      }),
    });
    const preflight = preflightSchema.parse(
      await invoke("preflightExecutionChange", {
        items: [
          {
            threadId: thread.id,
            witness,
            patch: { model: "test-provider-default", reasoningLevel: "low" },
          },
        ],
      }),
    );
    setThreadExecutionOverride(harness.db, {
      threadId: thread.id,
      modelOverride: "test-provider-default",
      reasoningLevelOverride: "high",
    });
    expect(
      await invoke("applyExecutionChange", {
        mutationId: "stale-change",
        items: [
          {
            threadId: thread.id,
            applyToken: preflight.result.results[0]!.applyToken,
          },
        ],
      }),
    ).toMatchObject({
      ok: true,
      result: { results: [{ status: "stale", threadId: thread.id }] },
    });
    expect(
      getThreadExecutionOverride(harness.db, thread.id)?.reasoningLevelOverride,
    ).toBe("high");
    const current = dashboardSchema
      .parse(
        await invoke("dashboard", {
          sinceDays: null,
          projectId: null,
          archiveState: "active",
          errorQuery: "",
          includeErrorHistory: false,
          excludeParticipantKeys: [],
        }),
      )
      .result.threads.find((row) => row.id === thread.id)!;
    const retry = preflightSchema.parse(
      await invoke("preflightExecutionChange", {
        items: [
          {
            threadId: thread.id,
            witness: current.execution.witness,
            patch: { model: "test-provider-default", reasoningLevel: "low" },
          },
        ],
      }),
    );
    expect(
      await invoke("applyExecutionChange", {
        mutationId: "fresh-change",
        items: [
          {
            threadId: thread.id,
            applyToken: retry.result.results[0]!.applyToken,
          },
        ],
      }),
    ).toMatchObject({
      ok: true,
      result: { results: [{ status: "applied", threadId: thread.id }] },
    });
    expect(
      getThreadExecutionOverride(harness.db, thread.id)?.reasoningLevelOverride,
    ).toBe("low");
  },
);
