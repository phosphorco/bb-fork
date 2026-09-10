import Database from "better-sqlite3";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  listThreadFacetOwnerProjections,
  queryThreadFacetThreadIds,
} from "@bb/db";
import { serializeThreadFacetTypeId } from "@bb/domain";
import { createNodeBbSdk } from "@bb/sdk/node";
import type { RunningTestServer } from "../../helpers/test-app.js";
import { startTestServer } from "../../helpers/test-app.js";
import {
  seedHostSession,
  seedPrimaryHost,
  seedProjectWithSource,
  seedThread,
} from "../../helpers/seed.js";

const threadProgressRoot = process.env.BB_THREAD_PROGRESS_PLUGIN_ROOT;
const integrationIt = threadProgressRoot === undefined ? it.skip : it;

describe("Thread Progress native facet writer", () => {
  let server: RunningTestServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  integrationIt("writes its declared phase through host-issued targets and fences replacement readiness", async () => {
    if (threadProgressRoot === undefined) {
      throw new Error("missing BB_THREAD_PROGRESS_PLUGIN_ROOT");
    }
    const running = await startTestServer();
    server = running;
    const { host } = seedHostSession(running.deps, {
      id: "host-thread-progress-native-facet",
    });
    seedPrimaryHost(running.deps, host.id);
    const { project } = seedProjectWithSource(running.deps, {
      hostId: host.id,
      path: "/tmp/thread-progress-native-facet",
    });
    const thread = seedThread(running.deps, { projectId: project.id });
    running.pluginService.bindSdk({ baseUrl: running.baseUrl });
    const installed = await running.pluginService.installPath(threadProgressRoot);
    expect(installed.status, installed.statusDetail ?? undefined).toBe("running");

    const typeId = serializeThreadFacetTypeId({
      scope: "plugin",
      owner: "thread-progress",
      localName: "phase",
    });
    await vi.waitFor(
      () => expect(listThreadFacetOwnerProjections(running.db, [typeId]))
        .toMatchObject([{ generation: 1, ownerState: "ready" }]),
      { timeout: 10_000 },
    );
    await running.pluginService.setEnabled("thread-progress", false);
    expect(listThreadFacetOwnerProjections(running.db, [typeId]))
      .toMatchObject([{ generation: 1, ownerState: "unavailable" }]);

    const pluginDatabase = new Database(
      join(running.config.dataDir, "plugins", "thread-progress", "data.db"),
    );
    try {
      expect(pluginDatabase.prepare(
        "UPDATE thread_progress SET phase = ? WHERE thread_id = ?",
      ).run("working", thread.id).changes).toBe(1);
    } finally {
      pluginDatabase.close();
    }

    await running.pluginService.setEnabled("thread-progress", true);
    expect(
      await createNodeBbSdk({ baseUrl: running.baseUrl }).threads.get({
        threadId: thread.id,
      }),
    ).toMatchObject({ id: thread.id });
    await vi.waitFor(
      () => expect(listThreadFacetOwnerProjections(running.db, [typeId]))
        .toMatchObject([{ generation: 2, ownerState: "ready" }]),
      { timeout: 10_000 },
    );
    expect(queryThreadFacetThreadIds(running.db, {
      filters: [{ typeId, operator: "contains", member: "working" }],
      includeHidden: false,
      pageSize: 10,
    }).threadIds).toEqual([thread.id]);

    const page = await createNodeBbSdk({ baseUrl: running.baseUrl }).threads.queryFacets({
      filters: [{ typeId, operator: "contains", member: "working" }],
      pageSize: 10,
    });
    expect(page.threads.map(({ id }) => id)).toEqual([thread.id]);
  }, 20_000);
});
