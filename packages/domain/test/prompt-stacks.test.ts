import { describe, expect, it } from "vitest";
import {
  p6rPromptStackSettingsSchema,
  p6rResolvePromptStacks,
} from "../src/prompt-stacks.js";

const settings = p6rPromptStackSettingsSchema.parse({
  stacks: [
    {
      id: "release",
      name: "Release",
      description: "Review and publish",
      steps: [
        {
          id: "review",
          agentPrompt: "Review the work",
          operatorComment: "Look for gaps",
        },
        {
          id: "publish",
          agentPrompt: "Publish the work",
          operatorComment: "",
        },
      ],
    },
  ],
  projectOverrides: {
    "project-1": {
      release: {
        steps: {
          review: { agentPrompt: "Review the work for this product" },
        },
      },
    },
  },
});

describe("prompt stacks", () => {
  it("applies only the matching project's step overrides", () => {
    expect(p6rResolvePromptStacks(settings, "project-1")[0]?.steps).toEqual([
      {
        id: "review",
        agentPrompt: "Review the work for this product",
        operatorComment: "Look for gaps",
      },
      {
        id: "publish",
        agentPrompt: "Publish the work",
        operatorComment: "",
      },
    ]);
    expect(p6rResolvePromptStacks(settings, "project-2")).toEqual(
      settings.stacks,
    );
  });

  it("rejects duplicate step ids", () => {
    expect(() =>
      p6rPromptStackSettingsSchema.parse({
        stacks: [
          {
            id: "duplicate",
            name: "Duplicate",
            description: "",
            steps: [
              { id: "same", agentPrompt: "One", operatorComment: "" },
              { id: "same", agentPrompt: "Two", operatorComment: "" },
            ],
          },
        ],
      }),
    ).toThrow();
  });
});
