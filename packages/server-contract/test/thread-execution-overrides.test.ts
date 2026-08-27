import { describe, expect, it } from "vitest";
import {
  EXPERIMENTAL_THREAD_EXECUTION_BATCH_LIMIT,
  experimentalThreadExecutionApplyRequestSchema,
  experimentalThreadExecutionPreflightRequestSchema,
} from "../src/api/threads.js";

describe("experimental thread execution override requests", () => {
  const threadId = (index: number) => {
    const alphabet = "23456789abcdefghijkmnpqrstuvwxyz";
    let value = index;
    let suffix = "";
    for (let offset = 0; offset < 10; offset += 1) {
      suffix = alphabet[value % alphabet.length]! + suffix;
      value = Math.floor(value / alphabet.length);
    }
    return `thr_${suffix}`;
  };

  it("rejects duplicate thread ids before service execution", () => {
    expect(
      experimentalThreadExecutionPreflightRequestSchema.safeParse({
        items: [
          {
            threadId: threadId(1),
            witness: "a".repeat(64),
            patch: { model: "opus" },
          },
          {
            threadId: threadId(1),
            witness: "b".repeat(64),
            patch: { model: "fable" },
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      experimentalThreadExecutionApplyRequestSchema.safeParse({
        items: [
          { threadId: threadId(1), applyToken: "one" },
          { threadId: threadId(1), applyToken: "two" },
        ],
      }).success,
    ).toBe(false);
  });

  it("accepts the limit and rejects limit plus one", () => {
    const items = Array.from(
      { length: EXPERIMENTAL_THREAD_EXECUTION_BATCH_LIMIT },
      (_, index) => ({ threadId: threadId(index), applyToken: "token" }),
    );
    expect(
      experimentalThreadExecutionApplyRequestSchema.safeParse({ items })
        .success,
    ).toBe(true);
    expect(
      experimentalThreadExecutionApplyRequestSchema.safeParse({
        items: [
          ...items,
          { threadId: threadId(items.length), applyToken: "token" },
        ],
      }).success,
    ).toBe(false);
  });
});
