import { describe, expect, it } from "vitest";
import {
  queryKeyMatchesRecoveryNamespace,
  recoveryScopedQueryKey,
} from "./recovery-query-key";

describe("Recovery Query keys", () => {
  it("keeps the ordinary key as an invalidation prefix while fencing owners", () => {
    const base = ["threadTimeline", "thread-a"] as const;
    const principalA = recoveryScopedQueryKey(base, "principal-a");
    const principalB = recoveryScopedQueryKey(base, "principal-b");
    expect(principalA.slice(0, base.length)).toEqual(base);
    expect(principalA).not.toEqual(principalB);
    expect(queryKeyMatchesRecoveryNamespace(principalA, "principal-a")).toBe(
      true,
    );
    expect(queryKeyMatchesRecoveryNamespace(principalA, "principal-b")).toBe(
      false,
    );
  });
});
