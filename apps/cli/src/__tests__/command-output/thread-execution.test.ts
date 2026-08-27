import { describe, expect, it, vi } from "vitest";
import {
  collectLogPayloads,
  runCommand,
  setupCommandOutputTestEnvironment,
  stubServerApi,
  type CommandRegistrar,
} from "../helpers/command-output-harness.js";
import { registerThreadCommands } from "../../commands/thread/index.js";

describe("bb thread execution command output", () => {
  setupCommandOutputTestEnvironment();
  const register: CommandRegistrar = (program) =>
    registerThreadCommands(program, () => "http://server");

  it("forwards a witnessed execution preflight batch", async () => {
    const result = { results: [] };
    const preflight = vi.fn(async () => result);
    stubServerApi({
      "v1.threads.execution-overrides.preflight.$post": preflight,
    });
    const items = [
      {
        threadId: "thr_23456789ab",
        witness: "a".repeat(64),
        patch: { model: "opus", reasoningLevel: "high" },
      },
    ];

    await runCommand(
      [
        "thread",
        "execution",
        "preflight",
        "--items-json",
        JSON.stringify(items),
        "--json",
      ],
      register,
    );

    expect(preflight).toHaveBeenCalledWith({ json: { items } });
    expect(
      JSON.parse(collectLogPayloads(vi.mocked(console.log)).join("\n")),
    ).toEqual(result);
  });

  it("forwards signed apply tokens", async () => {
    const result = { results: [] };
    const apply = vi.fn(async () => result);
    stubServerApi({ "v1.threads.execution-overrides.apply.$post": apply });
    const items = [{ threadId: "thr_23456789ab", applyToken: "signed-token" }];

    await runCommand(
      [
        "thread",
        "execution",
        "apply",
        "--items-json",
        JSON.stringify(items),
        "--json",
      ],
      register,
    );

    expect(apply).toHaveBeenCalledWith({ json: { items } });
  });
});
