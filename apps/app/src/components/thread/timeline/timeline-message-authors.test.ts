import { describe, expect, it } from "vitest";
import { conversationRow } from "@/test/fixtures/thread-timeline-rows";
import { p6rTimelineHasMultipleMessageAuthors } from "./ThreadTimelineRows";

function userRow(seq: number, p6rActorHandle: string | null) {
  return {
    ...conversationRow({
      id: `row_${seq}`,
      seq,
      role: "user",
      text: `message ${seq}`,
    }),
    p6rActorHandle,
  };
}

describe("p6rTimelineHasMultipleMessageAuthors", () => {
  it("stays single-author for null-handle (legacy/local) rows", () => {
    expect(
      p6rTimelineHasMultipleMessageAuthors([
        userRow(1, null),
        userRow(2, null),
      ]),
    ).toBe(false);
  });

  it("stays single-author when every attributed row shares one handle", () => {
    expect(
      p6rTimelineHasMultipleMessageAuthors([
        userRow(1, "alice"),
        userRow(2, "alice"),
        userRow(3, null),
      ]),
    ).toBe(false);
  });

  it("flips on the second distinct handle", () => {
    expect(
      p6rTimelineHasMultipleMessageAuthors([
        userRow(1, "alice"),
        userRow(2, null),
        userRow(3, "bob"),
      ]),
    ).toBe(true);
  });
});
