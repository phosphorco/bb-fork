import { describe, expect, it } from "vitest";
import {
  p6rClaimedIdentitySchema,
  p6rDecodeClaimedIdentityHeader,
  p6rEncodeClaimedIdentityHeader,
  p6rPrincipalKeySchema,
} from "@bb/domain";
import {
  p6rPresenceSummaryMessageSchema,
  p6rPresenceSnapshotResponseSchema,
  p6rThreadPresenceMessageLenientSchema,
  p6rThreadPresenceMessageSchema,
} from "../src/index.js";

describe("presence contracts", () => {
  it("preserves provider-qualified PrincipalKeys and legacy omission", () => {
    const principalKey = "github:acct-42";
    const identity = p6rClaimedIdentitySchema.parse({
      p6rHandle: "sawyer",
      p6rDisplayName: "Sawyer",
      p6rImageUrl: null,
      p6rClientId: "client-1",
      p6rPrincipalKey: principalKey,
    });
    expect(p6rPrincipalKeySchema.parse(principalKey)).toBe(principalKey);
    expect(
      p6rDecodeClaimedIdentityHeader(p6rEncodeClaimedIdentityHeader(identity)),
    ).toEqual(identity);

    for (const malformed of [
      "github",
      ":acct-42",
      "github:",
      "github:acct 42",
    ]) {
      expect(p6rPrincipalKeySchema.safeParse(malformed).success).toBe(false);
    }

    const legacy = {
      p6rHandle: "sawyer",
      p6rDisplayName: "Sawyer",
      p6rImageUrl: null,
      p6rClientId: "client-1",
    };
    expect(p6rClaimedIdentitySchema.parse(legacy)).toEqual(legacy);
    expect(
      p6rPresenceSnapshotResponseSchema.parse({
        p6rThreads: {
          "thread-1": [
            {
              p6rHandle: "sawyer",
              p6rDisplayName: "Sawyer",
              p6rImageUrl: null,
              p6rTyping: false,
            },
          ],
        },
      }),
    ).toBeTruthy();
  });

  it("validates strict snapshots and realtime messages", () => {
    const viewer = {
      p6rHandle: "sawyer",
      p6rDisplayName: "Sawyer",
      p6rImageUrl: null,
      p6rTyping: false,
    };
    expect(
      p6rPresenceSnapshotResponseSchema.parse({
        p6rThreads: { "thread-1": [viewer] },
      }),
    ).toEqual({ p6rThreads: { "thread-1": [viewer] } });
    expect(
      p6rThreadPresenceMessageSchema.parse({
        type: "p6r-thread-presence",
        p6rThreadId: "thread-1",
        p6rViewers: [viewer],
      }),
    ).toMatchObject({
      type: "p6r-thread-presence",
      p6rThreadId: "thread-1",
    });
    expect(
      p6rPresenceSummaryMessageSchema.parse({
        type: "p6r-presence-summary",
        p6rThreads: { "thread-1": ["sawyer"] },
      }),
    ).toEqual({
      type: "p6r-presence-summary",
      p6rThreads: { "thread-1": ["sawyer"] },
    });
  });

  it("rejects unknown strict fields while lenient inbound parsing strips them", () => {
    const message = {
      type: "p6r-thread-presence",
      p6rThreadId: "thread-1",
      p6rViewers: [
        {
          p6rHandle: "sawyer",
          p6rDisplayName: "Sawyer",
          p6rImageUrl: null,
          p6rTyping: false,
          futureViewerField: true,
        },
      ],
      futureMessageField: true,
    };
    expect(p6rThreadPresenceMessageSchema.safeParse(message).success).toBe(
      false,
    );
    expect(p6rThreadPresenceMessageLenientSchema.parse(message)).toEqual({
      type: "p6r-thread-presence",
      p6rThreadId: "thread-1",
      p6rViewers: [
        {
          p6rHandle: "sawyer",
          p6rDisplayName: "Sawyer",
          p6rImageUrl: null,
          p6rTyping: false,
        },
      ],
    });
  });
});
