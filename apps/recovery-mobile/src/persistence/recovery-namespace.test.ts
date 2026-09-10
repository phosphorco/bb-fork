import { describe, expect, it } from "vitest";
import {
  buildRecoveryNamespaceId,
  buildRecoveryServerProfileKey,
} from "./recovery-namespace";

describe("Recovery namespace identity", () => {
  it("separates principals and server origins even when a profile id is reused", () => {
    const base = {
      profileId: "profile-a",
      serverUrl: "https://one.example.test/",
      principalKey: "principal-a",
    };
    expect(buildRecoveryNamespaceId(base)).not.toBe(
      buildRecoveryNamespaceId({ ...base, principalKey: "principal-b" }),
    );
    expect(buildRecoveryNamespaceId(base)).not.toBe(
      buildRecoveryNamespaceId({
        ...base,
        serverUrl: "https://two.example.test",
      }),
    );
    expect(buildRecoveryServerProfileKey(base)).not.toBe(
      buildRecoveryServerProfileKey({
        ...base,
        serverUrl: "https://two.example.test",
      }),
    );
  });

  it("normalizes only an origin's trailing slash", () => {
    expect(
      buildRecoveryNamespaceId({
        profileId: "profile-a",
        serverUrl: "https://one.example.test/",
        principalKey: null,
      }),
    ).toBe(
      buildRecoveryNamespaceId({
        profileId: "profile-a",
        serverUrl: "https://one.example.test",
        principalKey: null,
      }),
    );
  });
});
