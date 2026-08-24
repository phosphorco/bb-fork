import {
  createStandaloneBuiltinCompactCommandInput,
  type PromptInput,
  type PromptMentionCommandOrigin,
  type ThreadEventRow,
} from "@bb/domain";
import type { SendMessageRequest } from "@bb/server-contract";
import { describe, expect, it } from "vitest";
import { getThreadEvents } from "../../helpers/api.js";
import { waitForThreadStatus } from "../../helpers/assertions.js";
import { withHarness } from "../../helpers/harness.js";
import { recordScriptedEchoRequests } from "../../helpers/scripted-echo.js";
import {
  createProjectFixture,
  createReadyThread,
  TURN_TIMEOUT_MS,
} from "./shared.js";

function compactCommandInput(args?: {
  origin?: PromptMentionCommandOrigin;
  text?: string;
}): PromptInput[] {
  const text = args?.text ?? "/compact";
  const start = text.indexOf("/compact");
  if (start === -1) {
    throw new Error("Expected compact command text");
  }
  return [
    {
      type: "text",
      text,
      mentions: [
        {
          start,
          end: start + "/compact".length,
          resource: {
            kind: "command",
            trigger: "/",
            name: "compact",
            source: "command",
            origin: args?.origin ?? "builtin",
            label: "compact",
            argumentHint: null,
          },
        },
      ],
    },
  ];
}

function textInput(text: string): PromptInput[] {
  return [{ type: "text", text, mentions: [] }];
}

function isItemType(
  event: ThreadEventRow,
  type: "agentMessage" | "contextCompaction",
): boolean {
  return (
    (event.type === "item/started" || event.type === "item/completed") &&
    event.data.item.type === type
  );
}

describe.sequential("authenticated builtin compact command integration", () => {
  it("classifies the original structured command before speaker annotation", async () => {
    const record = await recordScriptedEchoRequests();
    try {
      await withHarness(async (harness) => {
        const project = await createProjectFixture(
          harness,
          "Structured Compact Command",
        );
        const { thread } = await createReadyThread(harness, {
          projectId: project.id,
          providerId: "fake",
          workspace: { type: "unmanaged", path: harness.repoDir },
        });
        const baseline = await getThreadEvents(harness.api, thread.id);
        const input = createStandaloneBuiltinCompactCommandInput();

        const response = await harness.api.threads[":id"].send.$post({
          param: { id: thread.id },
          json: { mode: "start", input },
        });
        expect(response.status).toBe(200);
        await waitForThreadStatus(
          harness.api,
          thread.id,
          "idle",
          TURN_TIMEOUT_MS,
        );

        const events = (await getThreadEvents(harness.api, thread.id)).slice(
          baseline.length,
        );
        const requested = events.find(
          (event) => event.type === "client/turn/requested",
        );
        expect(requested).toMatchObject({
          p6rActorHandle: expect.any(String),
          data: {
            initiator: "user",
            input,
            senderThreadId: null,
          },
        });
        expect(
          events.some((event) => isItemType(event, "contextCompaction")),
        ).toBe(true);
        expect(events.some((event) => isItemType(event, "agentMessage"))).toBe(
          false,
        );

        const turnStarts = (await record.read()).filter(
          (request) =>
            request.method === "turn/start" &&
            request.params?.threadId === thread.id,
        );
        expect(turnStarts.at(-1)?.params?.input).toEqual(input);
      });
    } finally {
      await record.dispose();
    }
  });

  it("keeps non-exact, non-human, and non-builtin inputs ordinary", () =>
    withHarness(async (harness) => {
      const project = await createProjectFixture(
        harness,
        "Compact Command Negatives",
      );
      const { thread } = await createReadyThread(harness, {
        projectId: project.id,
        providerId: "fake",
        workspace: { type: "unmanaged", path: harness.repoDir },
      });
      const { thread: senderThread } = await createReadyThread(harness, {
        projectId: project.id,
        providerId: "fake",
        workspace: { type: "unmanaged", path: harness.repoDir },
      });
      const cases: Array<{
        input: PromptInput[];
        label: string;
        senderThreadId?: string;
      }> = [
        { label: "raw or pasted", input: textInput("/compact") },
        { label: "quoted", input: compactCommandInput({ text: "> /compact" }) },
        {
          label: "fenced",
          input: compactCommandInput({ text: "```\n/compact\n```" }),
        },
        {
          label: "inline code",
          input: compactCommandInput({ text: "`/compact`" }),
        },
        {
          label: "surrounding text",
          input: compactCommandInput({ text: "/compact then summarize" }),
        },
        {
          label: "project command",
          input: compactCommandInput({ origin: "project" }),
        },
        {
          label: "user command",
          input: compactCommandInput({ origin: "user" }),
        },
        {
          label: "other builtin slash command",
          input: [
            {
              type: "text",
              text: "/plan",
              mentions: [
                {
                  start: 0,
                  end: "/plan".length,
                  resource: {
                    kind: "command",
                    trigger: "/",
                    name: "plan",
                    source: "command",
                    origin: "builtin",
                    label: "plan",
                    argumentHint: null,
                  },
                },
              ],
            },
          ],
        },
        {
          label: "attachment bearing",
          input: [
            ...compactCommandInput(),
            { type: "image", url: "https://example.test/image.png" },
          ],
        },
        {
          label: "ordinary mention",
          input: textInput("please run /compact"),
        },
        {
          label: "agent authored",
          input: compactCommandInput(),
          senderThreadId: senderThread.id,
        },
      ];

      for (const testCase of cases) {
        const before = await getThreadEvents(harness.api, thread.id);
        const request: SendMessageRequest = {
          mode: "start",
          input: testCase.input,
          ...(testCase.senderThreadId === undefined
            ? {}
            : { senderThreadId: testCase.senderThreadId }),
        };
        const response = await harness.api.threads[":id"].send.$post({
          param: { id: thread.id },
          json: request,
        });
        expect(response.status, testCase.label).toBe(200);
        await waitForThreadStatus(
          harness.api,
          thread.id,
          "idle",
          TURN_TIMEOUT_MS,
        );
        const events = (await getThreadEvents(harness.api, thread.id)).slice(
          before.length,
        );
        expect(
          events.some((event) => isItemType(event, "contextCompaction")),
          testCase.label,
        ).toBe(false);
        expect(
          events.some((event) => isItemType(event, "agentMessage")),
          testCase.label,
        ).toBe(true);
      }
    }));
});
