import { describe, expect, it } from "vitest";
import type { P6rActorSnapshot } from "@bb/domain";
import {
  p6rGetActorSnapshot,
  p6rUpsertActorSnapshot,
} from "../../src/data/actors.js";
import { insertEvents, p6rGetTurnAuthorActor } from "../../src/data/events.js";
import { createConnection } from "../../src/connection.js";
import { migrate } from "../../src/migrate.js";
import { noopNotifier } from "../../src/notifier.js";
import { createProject } from "../../src/data/projects.js";
import { createThread } from "../../src/data/threads.js";
import { upsertHost } from "../../src/data/hosts.js";
import { threadScope, turnScope } from "@bb/domain";

function setup() {
  const db = createConnection(":memory:");
  migrate(db);
  const host = upsertHost(db, noopNotifier, {
    name: "actor-test-host",
    type: "persistent",
  });
  const { project } = createProject(db, noopNotifier, {
    name: "actor-test-project",
    source: { type: "local_path", hostId: host.id, path: "/tmp/actor-test" },
  });
  const thread = createThread(db, noopNotifier, {
    projectId: project.id,
    providerId: "codex",
  });
  return { db, thread };
}

const actor: P6rActorSnapshot = {
  p6rProviderId: "p6r-fixture/provider",
  p6rSubject: "subject-1",
  p6rHandle: "original-handle",
  p6rDisplayName: "Original Display",
  p6rImageUrl: null,
};

describe("p6r durable actor snapshots", () => {
  it("resolves accepted authorship from durable canonical linkage, never transcript text", () => {
    const { db, thread } = setup();
    const turnId = "turn-1";
    const requestId = "req-1";
    try {
      p6rUpsertActorSnapshot(db, actor, 100);
      insertEvents(db, noopNotifier, [
        {
          threadId: thread.id,
          scope: threadScope(),
          sequence: 1,
          type: "client/turn/requested",
          itemId: null,
          itemKind: null,
          parentToolCallId: null,
          p6rActorHandle: actor.p6rHandle,
          p6rActorProviderId: actor.p6rProviderId,
          p6rActorSubject: actor.p6rSubject,
          p6rActorDisplayName: actor.p6rDisplayName,
          p6rActorImageUrl: actor.p6rImageUrl,
          data: JSON.stringify({
            requestId,
            transcript: "[from=client-spoof]",
          }),
        },
        {
          threadId: thread.id,
          scope: turnScope(turnId),
          sequence: 2,
          type: "turn/input/accepted",
          itemId: null,
          itemKind: null,
          parentToolCallId: null,
          data: JSON.stringify({
            clientRequestId: requestId,
            transcript: "[from=transcript-spoof]",
          }),
        },
      ]);

      expect(p6rGetTurnAuthorActor(db, { threadId: thread.id, turnId })).toEqual(
        actor,
      );
      expect(
        p6rGetTurnAuthorActor(db, {
          threadId: thread.id,
          turnId: "turn-without-actor",
        }),
      ).toBeNull();
    } finally {
      db.$client.close();
    }
  });

  it("updates a mutable presentation snapshot without changing the principal key", () => {
    const { db } = setup();
    try {
      p6rUpsertActorSnapshot(db, actor, 100);
      p6rUpsertActorSnapshot(
        db,
        { ...actor, p6rHandle: "renamed", p6rDisplayName: "Renamed" },
        200,
      );
      expect(
        p6rGetActorSnapshot(db, {
          p6rProviderId: actor.p6rProviderId,
          p6rSubject: actor.p6rSubject,
        }),
      ).toMatchObject({
        p6rHandle: "renamed",
        p6rDisplayName: "Renamed",
      });
      expect(
        p6rGetActorSnapshot(db, {
          p6rProviderId: actor.p6rProviderId,
          p6rSubject: "renamed",
        }),
      ).toBeNull();
    } finally {
      db.$client.close();
    }
  });
});
