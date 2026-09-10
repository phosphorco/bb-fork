import { describe, expect, it } from "vitest";
import { conversationRow } from "@/test/fixtures/thread-timeline-rows";
import { p6rShouldShowTimelineMessageAuthors } from "./ThreadTimelineRows";

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

describe("p6rShouldShowTimelineMessageAuthors", () => {
  it("stays single-author for null-handle (legacy/local) rows", () => {
    expect(
      p6rShouldShowTimelineMessageAuthors(
        [userRow(1, null), userRow(2, null)],
        undefined,
      ),
    ).toBe(false);
  });

  it("stays single-author when every attributed row shares one handle", () => {
    expect(
      p6rShouldShowTimelineMessageAuthors(
        [userRow(1, "alice"), userRow(2, "alice"), userRow(3, null)],
        undefined,
      ),
    ).toBe(false);
  });

  it("shows authors when the durable roster has multiple participants", () => {
    expect(p6rShouldShowTimelineMessageAuthors([userRow(1, "alice")], 2)).toBe(
      true,
    );
  });

  it("flips on the second distinct handle", () => {
    expect(
      p6rShouldShowTimelineMessageAuthors(
        [userRow(1, "alice"), userRow(2, null), userRow(3, "bob")],
        undefined,
      ),
    ).toBe(true);
  });
});
