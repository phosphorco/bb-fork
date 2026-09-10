import { describe, expect, it } from "vitest";
import { threadScope, turnScope } from "@bb/domain";
import { p6rListActiveBackgroundCommandStartsByThreadIds } from "../../src/data/background-command-activity.js";
import { insertEvents } from "../../src/data/events.js";
import { upsertHost } from "../../src/data/hosts.js";
import { createProject } from "../../src/data/projects.js";
import { createThread } from "../../src/data/threads.js";
import { noopNotifier } from "../../src/notifier.js";
import { createMigratedConnection } from "../helpers/migrated-connection.js";

function setup() {
  const db = createMigratedConnection();
  const host = upsertHost(db, noopNotifier, {
    name: "test-host",
    type: "persistent",
  });
  const { project } = createProject(db, noopNotifier, {
    name: "test-project",
    source: { type: "local_path", hostId: host.id, path: "/tmp/test" },
  });
  const thread = createThread(db, noopNotifier, {
    projectId: project.id,
    providerId: "claude-code",
  });
  return { db, thread };
}

function taskData(
  itemId: string,
  taskType = "local_bash",
  status = "pending",
  skipTranscript = false,
) {
  return JSON.stringify({
    item: {
      id: itemId,
      type: "backgroundTask",
      taskType,
      description: "fixture command",
      status,
      taskStatus: status === "completed" ? "completed" : "running",
      skipTranscript,
    },
  });
}

describe("active background command starts", () => {
  it("returns the newest start across open provider shell commands", () => {
    const { db, thread } = setup();

    insertEvents(db, noopNotifier, [
      {
        threadId: thread.id,
        sequence: 1,
        createdAt: 1_000,
        scope: turnScope("turn-1"),
        type: "item/started",
        itemId: "task:bash-1",
        itemKind: "backgroundTask",
        parentToolCallId: null,
        data: taskData("task:bash-1"),
      },
      {
        threadId: thread.id,
        sequence: 2,
        createdAt: 2_000,
        scope: threadScope(),
        type: "item/backgroundTask/progress",
        itemId: "task:bash-1",
        itemKind: "backgroundTask",
        parentToolCallId: null,
        data: taskData("task:bash-1"),
      },
      {
        threadId: thread.id,
        sequence: 3,
        createdAt: 3_000,
        scope: turnScope("turn-2"),
        type: "item/started",
        itemId: "task:bash-2",
        itemKind: "backgroundTask",
        parentToolCallId: null,
        data: taskData("task:bash-2"),
      },
    ]);

    expect(
      p6rListActiveBackgroundCommandStartsByThreadIds(db, {
        threadIds: [thread.id],
      }),
    ).toEqual([
      {
        threadId: thread.id,
        newestActiveBackgroundCommandStartedAt: 3_000,
      },
    ]);
  });

  it("excludes completed, transcript-hidden, and non-shell tasks", () => {
    const { db, thread } = setup();

    insertEvents(db, noopNotifier, [
      {
        threadId: thread.id,
        sequence: 1,
        createdAt: 1_000,
        scope: turnScope("turn-1"),
        type: "item/started",
        itemId: "task:completed",
        itemKind: "backgroundTask",
        parentToolCallId: null,
        data: taskData("task:completed"),
      },
      {
        threadId: thread.id,
        sequence: 2,
        createdAt: 2_000,
        scope: threadScope(),
        type: "item/backgroundTask/completed",
        itemId: "task:completed",
        itemKind: "backgroundTask",
        parentToolCallId: null,
        data: taskData("task:completed", "local_bash", "completed"),
      },
      {
        threadId: thread.id,
        sequence: 3,
        createdAt: 3_000,
        scope: turnScope("turn-2"),
        type: "item/started",
        itemId: "task:hidden",
        itemKind: "backgroundTask",
        parentToolCallId: null,
        data: taskData("task:hidden", "local_bash", "pending", true),
      },
      {
        threadId: thread.id,
        sequence: 4,
        createdAt: 4_000,
        scope: turnScope("turn-3"),
        type: "item/started",
        itemId: "task:workflow",
        itemKind: "backgroundTask",
        parentToolCallId: null,
        data: taskData("task:workflow", "local_workflow"),
      },
    ]);

    expect(
      p6rListActiveBackgroundCommandStartsByThreadIds(db, {
        threadIds: [thread.id],
      }),
    ).toEqual([]);
    expect(
      p6rListActiveBackgroundCommandStartsByThreadIds(db, { threadIds: [] }),
    ).toEqual([]);
  });
});
