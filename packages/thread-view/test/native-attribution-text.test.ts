import { expect, it } from "vitest";
import { timelineUserConversationRowSchema } from "@bb/server-contract";
import { formatThreadTimelineText } from "../src/format-timeline-text.js";

it("renders immutable external source and editor in CLI timeline output", () => {
  const row = timelineUserConversationRowSchema.parse({
    id: "row", threadId: "thread", turnId: "turn", sourceSeqStart: 1, sourceSeqEnd: 1,
    startedAt: 1, createdAt: 1, kind: "conversation", role: "user", text: "Hello", attachments: null,
    initiator: "user", senderThreadId: null, systemMessageKind: "unlabeled", systemMessageSubject: null, mentions: [],
    turnRequest: { kind: "message", isGrouped: false, status: "accepted" },
    attribution: [{ author: { kind: "external", actor: {
      evidence: "integration-asserted", identity: { kind: "external", key: "x", pluginId: "rosetta-slack", subject: "x" },
      presentation: { displayName: "Bob", handle: null, avatarUrl: null },
    } }, latestEditor: { evidence: "provider-verified", identity: { kind: "person", key: "a", issuer: "fixture", subject: "a" },
      presentation: { displayName: "Alice", handle: null, avatarUrl: null } } }],
  });
  expect(formatThreadTimelineText([row])).toContain("Bob via rosetta-slack; edited by Alice");
});
