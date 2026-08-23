import { Command } from "commander";
import type { P6rMember } from "@bb/server-contract";
import { action } from "../action.js";
import { createCliBbSdk } from "../client.js";
import { renderBorderlessTable } from "../table.js";
import { outputJson, type JsonOutputOptions } from "./helpers.js";

function p6rPrintMembers(members: P6rMember[]): void {
  if (members.length === 0) {
    console.log("No members");
    return;
  }
  const rows = members.map((member) => [
    member.p6rHandle,
    member.p6rDisplayName,
    member.p6rImageUrl ?? "",
  ]);
  const widths = [
    Math.max(6, ...rows.map((row) => row[0].length)),
    Math.max(4, ...rows.map((row) => row[1].length)),
    Math.max(6, ...rows.map((row) => row[2].length)),
  ];
  console.log("");
  console.log(
    renderBorderlessTable(
      {
        head: ["Handle", "Name", "Avatar"],
        colWidths: widths,
        trimTrailingWhitespace: true,
      },
      rows,
    ),
  );
  console.log("");
}

export function p6rRegisterMembersCommands(
  program: Command,
  getUrl: () => string,
): void {
  const members = program
    .command("p6r-members")
    .description("Manage Connect members for this bb");

  members
    .command("list")
    .description("List members admitted through Connect")
    .option("--json", "Print machine-readable JSON output")
    .action(
      action(async (options: JsonOutputOptions) => {
        const result = await createCliBbSdk(getUrl()).p6rMembers.p6rList();
        if (outputJson(options, result)) return;
        p6rPrintMembers(result);
      }),
    );

  members
    .command("add <handle>")
    .description("Add a Connect account by handle")
    .option("--json", "Print machine-readable JSON output")
    .action(
      action(async (handle: string, options: JsonOutputOptions) => {
        const member = await createCliBbSdk(getUrl()).p6rMembers.p6rAdd({
          p6rHandle: handle,
        });
        if (outputJson(options, member)) return;
        console.log(`Added @${member.p6rHandle} (${member.p6rDisplayName})`);
      }),
    );

  members
    .command("remove <handle>")
    .description("Remove a Connect member by handle")
    .option("--json", "Print machine-readable JSON output")
    .action(
      action(async (handle: string, options: JsonOutputOptions) => {
        const result = await createCliBbSdk(getUrl()).p6rMembers.p6rRemove({
          p6rHandle: handle,
        });
        if (outputJson(options, result)) return;
        console.log(`Removed @${handle.trim().toLowerCase()}`);
      }),
    );
}
