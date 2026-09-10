// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { NativeActorSnapshot } from "@bb/domain";
import { NativeMessageAttribution } from "./NativeMessageAttribution.js";

afterEach(cleanup);
const alice: NativeActorSnapshot & { identity: { kind: "person"; key: string; issuer: string; subject: string } } = {
  evidence: "provider-verified", identity: { kind: "person", key: "a", issuer: "fixture", subject: "a" },
  presentation: { displayName: "Alice", handle: null, avatarUrl: "/avatars/a.png" },
};

it("preserves the undecorated legacy layout when attribution is unknown", () => {
  const view = render(<NativeMessageAttribution sources={[{ author: { kind: "unknown", reason: "legacy" }, latestEditor: null }]} />);
  expect(view.container.textContent).toBe("");
});

it("shows the recorded external source and a distinct editor", () => {
  render(<NativeMessageAttribution sources={[{
    author: { kind: "external", actor: { evidence: "integration-asserted",
      identity: { kind: "external", key: "slack:b", pluginId: "rosetta-slack", subject: "b" },
      presentation: { displayName: "Bob", handle: null, avatarUrl: null } } }, latestEditor: alice,
  }]} />);
  expect(screen.getByText("Bob")).toBeTruthy();
  expect(screen.getByText("via rosetta-slack")).toBeTruthy();
  expect(screen.getByText("Edited by Alice")).toBeTruthy();
});

it("does not invent an editor change or conceal mixed unknown sources", () => {
  render(<NativeMessageAttribution sources={[
    { author: { kind: "person", actor: alice }, latestEditor: alice },
    { author: { kind: "unknown", reason: "missing-source" }, latestEditor: null },
  ]} />);
  expect(screen.getByText("Alice")).toBeTruthy();
  expect(screen.queryByText(/Edited by/)).toBeNull();
  expect(screen.getByText("Unknown source")).toBeTruthy();
});
