import { describe, expect, it } from "vitest";
import {
  createConnection,
  migrate,
  p6rGetPromptStackSettings,
  p6rSetPromptStackSettings,
} from "../../src/index.js";

describe("prompt stack settings", () => {
  it("round-trips the catalog and project overrides without a migration", () => {
    const db = createConnection(":memory:");
    try {
      migrate(db);
      const settings = {
        stacks: [
          {
            id: "review",
            name: "Review",
            description: "Review the work",
            steps: [
              {
                id: "first",
                agentPrompt: "Review this",
                operatorComment: "",
              },
            ],
          },
        ],
        projectOverrides: {
          project1: {
            review: {
              steps: { first: { agentPrompt: "Review this carefully" } },
            },
          },
        },
      };
      p6rSetPromptStackSettings(db, settings);
      expect(p6rGetPromptStackSettings(db)).toEqual(settings);
    } finally {
      db.$client.close();
    }
  });
});
