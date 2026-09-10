import { describe, expect, it } from "vitest";
import {
  MY_PROGRESS_SIDEBAR_SECTION_ID,
  mergeHiddenSectionOrder,
  resolveSidebarSectionOrder,
} from "./sidebar-section-order";

describe("mergeHiddenSectionOrder", () => {
  it("applies the visible reorder while hidden sections keep their index", () => {
    expect(
      mergeHiddenSectionOrder(
        ["project:a", "pinned", "project:b", "threads"],
        ["threads", "project:b", "project:a"],
      ),
    ).toEqual(["threads", "pinned", "project:b", "project:a"]);
  });

  it("is the identity when nothing is hidden", () => {
    expect(
      mergeHiddenSectionOrder(
        ["pinned", "project:a", "threads"],
        ["project:a", "threads", "pinned"],
      ),
    ).toEqual(["project:a", "threads", "pinned"]);
  });
});

describe("resolveSidebarSectionOrder", () => {
  const model = {
    organize: "project" as const,
    groups: [{ id: "project:a" as const }, { id: "threads" as const }],
  };

  it("adds My progress without changing the legacy section order", () => {
    expect(
      resolveSidebarSectionOrder(model, ["pinned", "project:a", "threads"]),
    ).toEqual([
      "pinned",
      MY_PROGRESS_SIDEBAR_SECTION_ID,
      "project:a",
      "threads",
    ]);
  });

  it("preserves the saved personal presentation placement", () => {
    expect(
      resolveSidebarSectionOrder(model, [
        "threads",
        MY_PROGRESS_SIDEBAR_SECTION_ID,
        "pinned",
        "project:a",
      ]),
    ).toEqual([
      "threads",
      MY_PROGRESS_SIDEBAR_SECTION_ID,
      "pinned",
      "project:a",
    ]);
  });
});
