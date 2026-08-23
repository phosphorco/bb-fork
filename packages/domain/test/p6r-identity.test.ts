import { describe, expect, it } from "vitest";
import {
  p6rActorPrincipalSchema,
  p6rCreateLocalPrincipalKey,
  p6rCreateProviderPrincipalKey,
  p6rPrincipalKeyForActorSnapshot,
} from "../src/index.js";

describe("p6r exact principal keys", () => {
  it("preserves simple spellings and separates reserved identity components", () => {
    expect(p6rCreateLocalPrincipalKey("Sawyer")).toBe("local:sawyer");
    expect(p6rCreateProviderPrincipalKey("github", "acct-42")).toBe(
      "github:acct-42",
    );
    const left = p6rPrincipalKeyForActorSnapshot({
      p6rProviderId: "a/b",
      p6rSubject: "c",
    });
    const right = p6rPrincipalKeyForActorSnapshot({
      p6rProviderId: "a",
      p6rSubject: "b/c",
    });
    expect(left).toBe("p6r:a%2Fb/c");
    expect(right).toBe("p6r:a/b%2Fc");
    expect(left).not.toBe(right);
  });

  it("canonically carries whitespace, reserved characters, Unicode, and maximum inputs", () => {
    expect(
      p6rPrincipalKeyForActorSnapshot({
        p6rProviderId: "provider space/雪",
        p6rSubject: " subject?#/☃ ",
      }),
    ).toBe("p6r:provider%20space%2F%E9%9B%AA/%20subject%3F%23%2F%E2%98%83%20");
    expect(() =>
      p6rPrincipalKeyForActorSnapshot({
        p6rProviderId: "界".repeat(256),
        p6rSubject: "雪".repeat(512),
      }),
    ).not.toThrow();
  });

  it("rejects malformed Unicode at the actor boundary", () => {
    const malformed = "\ud800";
    expect(
      p6rActorPrincipalSchema.safeParse({
        p6rProviderId: "provider",
        p6rSubject: malformed,
      }).success,
    ).toBe(false);
    expect(() =>
      p6rPrincipalKeyForActorSnapshot({
        p6rProviderId: "provider",
        p6rSubject: malformed,
      }),
    ).toThrow();
  });
});
