// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createQueryClientTestHarness } from "@/test/queryClientTestHarness";
import { sdk } from "@/lib/sdk";
import { NativeIdentitySettingsSection } from "./NativeIdentitySettingsSection.js";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("shows supplied identity and refreshes to explicit unavailability without editing controls", async () => {
  vi.spyOn(sdk.system, "nativeIdentity")
    .mockResolvedValueOnce({ status: "ready", revision: "one", actor: {
      evidence: "provider-verified", identity: { kind: "person", key: "a", issuer: "fixture", subject: "a" },
      presentation: { displayName: "Alice", handle: "alice", avatarUrl: "/avatars/a.png" },
    } }).mockResolvedValue({ status: "unavailable" });
  const harness = createQueryClientTestHarness();
  render(<NativeIdentitySettingsSection />, { wrapper: harness.wrapper });
  expect(await screen.findByText("Alice")).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Refresh identity" }));
  expect(await screen.findByText("Identity is unavailable.")).toBeTruthy();
  expect(screen.queryByText("Alice")).toBeNull();
  harness.queryClient.clear();
});

it("does not invent a local actor when the boundary is absent", async () => {
  vi.spyOn(sdk.system, "nativeIdentity").mockResolvedValue({ status: "unsupported" });
  const harness = createQueryClientTestHarness();
  render(<NativeIdentitySettingsSection />, { wrapper: harness.wrapper });
  expect(await screen.findByText("No identity provider is configured.")).toBeTruthy();
  harness.queryClient.clear();
});
