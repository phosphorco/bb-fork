// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  p6rClearClaimedIdentity,
  p6rGetClaimedIdentity,
  p6rIsRemoteAppContext,
  p6rResetClaimedIdentityStoreForTest,
  p6rSetClaimedDisplayName,
  p6rShouldOfferClaimedIdentity,
} from "./claimed-identity-store";

afterEach(() => {
  localStorage.clear();
  p6rResetClaimedIdentityStoreForTest();
});

describe("claimed identity store", () => {
  // jsdom serves the suite from localhost, which is exactly the context that
  // must never claim an identity — desktop/localhost run as the local operator.
  it("treats the localhost origin as non-remote and suppresses any identity", () => {
    expect(p6rIsRemoteAppContext()).toBe(false);
    p6rSetClaimedDisplayName("Alice Chen");
    expect(p6rGetClaimedIdentity()).toBeNull();
  });

  it("normalizes the display name into the stored p6rHandle", () => {
    const identity = p6rSetClaimedDisplayName("  Alice Chen  ");
    expect(identity).not.toBeNull();
    expect(identity?.p6rDisplayName).toBe("Alice Chen");
    expect(identity?.p6rHandle).toBe("alice chen");
    expect(identity?.p6rImageUrl).toBeNull();
    expect(identity?.p6rClientId.length).toBeGreaterThan(0);
  });

  it("creates a client identifier without crypto.randomUUID", () => {
    const originalRandomUUID = globalThis.crypto.randomUUID;
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      configurable: true,
      value: undefined,
    });
    try {
      const identity = p6rSetClaimedDisplayName("Alice Chen");
      expect(identity?.p6rClientId).toMatch(/^[A-Za-z0-9_-]+$/u);
    } finally {
      Object.defineProperty(globalThis.crypto, "randomUUID", {
        configurable: true,
        value: originalRandomUUID,
      });
    }
  });

  it("rejects names that normalize to nothing", () => {
    expect(p6rSetClaimedDisplayName("   ")).toBeNull();
  });

  it("keeps the same p6rClientId across identity changes", () => {
    const first = p6rSetClaimedDisplayName("Alice");
    const second = p6rSetClaimedDisplayName("Alice Cooper");
    expect(second?.p6rClientId).toBe(first?.p6rClientId);
  });

  it("persists the identity to storage and reloads it", () => {
    p6rSetClaimedDisplayName("Alice");
    p6rResetClaimedIdentityStoreForTest();
    // Storage round-trip: stored value survives a module-state reset. The
    // localhost gate still hides it from p6rGetClaimedIdentity, so assert the raw
    // persisted record instead.
    const raw = localStorage.getItem("bb.p6rClaimedIdentity");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw ?? "{}")).toMatchObject({
      p6rHandle: "alice",
      p6rDisplayName: "Alice",
      p6rImageUrl: null,
    });
  });

  it("clears the stored identity", () => {
    p6rSetClaimedDisplayName("Alice");
    p6rClearClaimedIdentity();
    expect(localStorage.getItem("bb.p6rClaimedIdentity")).toBeNull();
  });

  it.each([
    ["trusted provider", "trusted-provider", false],
    ["unclaimed no-provider", null, true],
    ["claimed mode before a local claim", "claimed", true],
    ["local operator", "local-operator", true],
  ] as const)(
    "keeps the claim prompt assurance-aware for %s",
    (_label, assurance, expected) => {
      expect(
        p6rShouldOfferClaimedIdentity({
          remote: true,
          serverBoundaryResolved: true,
          assurance,
          hasClaimedIdentity: false,
          dismissed: false,
        }),
      ).toBe(expected);
    },
  );

  it("does not offer a claim before the server boundary resolves", () => {
    expect(
      p6rShouldOfferClaimedIdentity({
        remote: true,
        serverBoundaryResolved: false,
        assurance: null,
        hasClaimedIdentity: false,
        dismissed: false,
      }),
    ).toBe(false);
  });
});
