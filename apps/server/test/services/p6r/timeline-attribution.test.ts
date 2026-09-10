import { expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { timelineUserConversationRowSchema } from "@bb/server-contract";
import { withTestHarness } from "../../helpers/test-app.js";
import { seedThreadFixture } from "../../helpers/seed.js";
import {
  p6rAttempts,
  p6rAttemptInputs,
  p6rContributions,
} from "../../../src/services/p6r/sidecar-schema.js";
import { projectP6rNativeTimelineAttribution } from "../../../src/services/p6r/timeline-attribution.js";

it("joins exact request/group facts and rejects foreign or malformed evidence without changing cached rows", async () => {
  await withTestHarness(async (harness) => {
    const { thread } = seedThreadFixture(harness);
    const other = seedThreadFixture(harness).thread;
    const alice = {
      evidence: "provider-verified",
      identity: {
        kind: "person",
        key: "person:a",
        issuer: "fixture",
        subject: "a",
      },
      presentation: {
        displayName: "Alice",
        handle: null,
        avatarUrl: "/avatars/a.png",
      },
    };
    const external = {
      evidence: "integration-asserted",
      identity: {
        kind: "external",
        key: "external:b",
        pluginId: "rosetta-slack",
        subject: "b",
      },
      presentation: { displayName: "Bob", handle: null, avatarUrl: null },
    };
    harness.db
      .insert(p6rContributions)
      .values([
        {
          id: "a",
          threadId: thread.id,
          acceptedAt: 1,
          acceptedAuthorship: JSON.stringify(alice),
          latestEditor: JSON.stringify(alice),
          initialInput: "[]",
          currentProjection: "[]",
        },
        {
          id: "b",
          threadId: thread.id,
          acceptedAt: 2,
          acceptedAuthorship: JSON.stringify(external),
          latestEditor: JSON.stringify(alice),
          initialInput: "[]",
          currentProjection: "[]",
        },
        {
          id: "foreign",
          threadId: other.id,
          acceptedAt: 3,
          acceptedAuthorship: JSON.stringify(alice),
          latestEditor: "null",
          initialInput: "[]",
          currentProjection: "[]",
        },
      ])
      .run();
    harness.db
      .insert(p6rAttempts)
      .values({
        id: "attempt",
        threadId: thread.id,
        nativeRequestId: "request",
        createdAt: 1,
      })
      .run();
    harness.db
      .insert(p6rAttemptInputs)
      .values(
        ["a", "b", "foreign"].map((contributionId, groupIndex) => ({
          attemptId: "attempt",
          groupIndex,
          sourceIndex: 0,
          sourceKind: "contribution",
          contributionId,
          snapshot: "[]",
        })),
      )
      .run();
    const row = (groupIndex: number) =>
      timelineUserConversationRowSchema.parse({
        id: String(groupIndex),
        threadId: thread.id,
        turnId: "turn",
        sourceSeqStart: 99,
        sourceSeqEnd: 99,
        startedAt: 1,
        createdAt: 1,
        kind: "conversation",
        role: "user",
        text: "same text",
        attachments: null,
        initiator: "user",
        senderThreadId: null,
        systemMessageKind: "unlabeled",
        systemMessageSubject: null,
        mentions: [],
        turnRequest: {
          kind: "steer",
          isGrouped: true,
          status: "accepted",
          source: { requestId: "request", inputGroupIndex: groupIndex },
        },
      });
    const rows = [row(1), row(2), row(3)];
    expect(
      projectP6rNativeTimelineAttribution(harness.db, thread.id, rows),
    ).toMatchObject([
      {
        attribution: [
          {
            author: { kind: "external", actor: external },
            latestEditor: alice,
          },
        ],
      },
      { attribution: [{ author: { kind: "unknown" } }] },
      { attribution: [{ author: { kind: "unknown" } }] },
    ]);
    expect(rows.every((value) => value.attribution === undefined)).toBe(true);
    harness.db
      .update(p6rContributions)
      .set({ acceptedAuthorship: "{broken", latestEditor: "null" })
      .where(eq(p6rContributions.id, "b"))
      .run();
    expect(
      projectP6rNativeTimelineAttribution(harness.db, thread.id, rows)[0],
    ).toMatchObject({
      attribution: [{ author: { kind: "unknown" }, latestEditor: null }],
    });
  });
});
