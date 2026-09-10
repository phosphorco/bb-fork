import { describe, expect, it } from "vitest";
import { formatPromptInputForProvider } from "./input-provenance.js";

describe("formatPromptInputForProvider", () => {
  it("adds one frozen label per attributed group without changing attachment input", () => {
    const input = [
      { type: "text" as const, text: "hello", mentions: [] },
      { type: "text" as const, text: "\n\n", mentions: [] },
      {
        type: "localFile" as const,
        path: "/tmp/brief.pdf",
        name: "brief.pdf",
        mimeType: "application/pdf",
      },
    ];
    const formatted = formatPromptInputForProvider(
      input,
      [[input[0]!], [input[2]!]],
      [
        {
          groupIndex: 0,
          sources: [
            {
              sourceKind: "contribution",
              sourceIndex: 0,
              contributionId: "p6r-contribution:one",
              attribution: {
                author: {
                  kind: "external",
                  actor: {
                    evidence: "integration-asserted",
                    identity: {
                      kind: "external",
                      key: "p6r-external:v1:one",
                      pluginId: "rosetta-slack",
                      subject: "U123",
                    },
                    presentation: {
                      displayName: "Ada",
                      handle: "ada",
                      avatarUrl: null,
                    },
                  },
                },
                latestEditor: null,
              },
            },
          ],
        },
        { groupIndex: 1, sources: [] },
      ],
    );

    expect(formatted).toEqual([
      {
        type: "text",
        text: '[BB input source: external source "rosetta-slack"]',
        mentions: [],
      },
      input[0],
      { type: "text", text: "\n", mentions: [] },
      input[2],
    ]);
  });

  it("does not infer provenance for legacy raw input", () => {
    const input = [{ type: "text" as const, text: "hello", mentions: [] }];
    expect(formatPromptInputForProvider(input, undefined, undefined)).toEqual(
      input,
    );
  });
});
