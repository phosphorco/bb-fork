import { describe, expect, it, vi } from "vitest";
import {
  collectLogLines,
  collectLogPayloads,
  getHelpOutput,
  runCommand,
  setupCommandOutputTestEnvironment,
  stubServerApi,
  type CommandRegistrar,
} from "../helpers/command-output-harness.js";
import { p6rRegisterMembersCommands } from "../../commands/members.js";

const member = {
  p6rUserId: "member-1",
  p6rHandle: "collaborator",
  p6rDisplayName: "Collaborator",
  p6rImageUrl: null,
  p6rAddedByUserId: "owner-1",
  p6rCreatedAt: 123,
};

describe("bb p6r-members commands", () => {
  setupCommandOutputTestEnvironment();

  const register: CommandRegistrar = (program) =>
    p6rRegisterMembersCommands(program, () => "http://server");

  it("lists members in human and JSON output", async () => {
    stubServerApi({
      "v1.p6r-members.$get": vi.fn(async () => ({ p6rMembers: [member] })),
    });

    await runCommand(["p6r-members", "list"], register);
    expect(collectLogLines(vi.mocked(console.log)).join("\n")).toContain(
      "collaborator",
    );

    vi.mocked(console.log).mockClear();
    await runCommand(["p6r-members", "list", "--json"], register);
    expect(collectLogPayloads(vi.mocked(console.log))).toEqual([
      JSON.stringify([member], null, 2),
    ]);
  });

  it("adds and removes a member", async () => {
    const add = vi.fn(async () => member);
    const remove = vi.fn(async () => ({ ok: true }));
    stubServerApi({
      "v1.p6r-members.$post": add,
      "v1.p6r-members.$delete": remove,
    });

    await runCommand(["p6r-members", "add", "collaborator"], register);
    await runCommand(["p6r-members", "remove", "collaborator"], register);

    expect(add).toHaveBeenCalledWith({
      json: { p6rHandle: "collaborator" },
    });
    expect(remove).toHaveBeenCalledWith({
      json: { p6rHandle: "collaborator" },
    });
    expect(collectLogLines(vi.mocked(console.log))).toEqual([
      "Added @collaborator (Collaborator)",
      "Removed @collaborator",
    ]);
  });

  it.each([
    [404, "connect_not_enrolled", "not enrolled in Connect"],
    [404, "unknown_handle", "No Connect account has the handle"],
    [409, "already_member", "already a member"],
    [403, "member_management_tunnel_forbidden", "owner's local console"],
  ])("prints the server's clear %i error", async (status, code, message) => {
    stubServerApi({
      "v1.p6r-members.$post": vi.fn(
        async () =>
          new Response(JSON.stringify({ code, message }), {
            status,
            headers: { "content-type": "application/json" },
          }),
      ),
    });

    await expect(
      runCommand(["p6r-members", "add", "collaborator"], register),
    ).rejects.toThrow("process.exit:1");
    expect(collectLogLines(vi.mocked(console.error)).join("\n")).toContain(
      message,
    );
  });

  it("documents every member command and JSON output", async () => {
    const help = await getHelpOutput(["p6r-members"], register);
    const listHelp = await getHelpOutput(["p6r-members", "list"], register);
    expect(help).toContain("list");
    expect(help).toContain("add");
    expect(help).toContain("remove");
    expect(listHelp).toContain("--json");
  });
});
