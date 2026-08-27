import { Command } from "commander";
import {
  experimentalThreadExecutionApplyRequestSchema,
  experimentalThreadExecutionPreflightRequestSchema,
} from "@bb/server-contract";
import { action } from "../../action.js";
import { createCliBbSdk } from "../../client.js";
import { getErrorMessage, outputJson } from "../helpers.js";

interface ExecutionBatchOptions {
  itemsJson: string;
  json?: boolean;
}

export function p6rRegisterExecutionCommands(
  parent: Command,
  getUrl: () => string,
): void {
  const execution = parent
    .command("execution")
    .description("Inspect and change sticky next-turn execution overrides");

  execution
    .command("preflight")
    .description(
      "Validate a witnessed batch and issue short-lived apply tokens",
    )
    .requiredOption(
      "--items-json <json>",
      "JSON array of {threadId,witness,patch} items (maximum 5000)",
    )
    .option("--json", "Print machine-readable JSON output")
    .action(
      action(async (opts: ExecutionBatchOptions) => {
        const request = parseItems(
          opts.itemsJson,
          experimentalThreadExecutionPreflightRequestSchema,
        );
        const result =
          await createCliBbSdk(
            getUrl(),
          ).threads.experimental_preflightExecutionOverrides(request);
        if (outputJson(opts, result)) return;
        for (const entry of result.results) {
          console.log(`${entry.threadId}\t${entry.status}`);
        }
      }),
    );

  execution
    .command("apply")
    .description("Atomically apply a preflighted execution-override batch")
    .requiredOption(
      "--items-json <json>",
      "JSON array of {threadId,applyToken} items (maximum 5000)",
    )
    .option("--json", "Print machine-readable JSON output")
    .action(
      action(async (opts: ExecutionBatchOptions) => {
        const request = parseItems(
          opts.itemsJson,
          experimentalThreadExecutionApplyRequestSchema,
        );
        const result =
          await createCliBbSdk(
            getUrl(),
          ).threads.experimental_applyExecutionOverrides(request);
        if (outputJson(opts, result)) return;
        for (const entry of result.results) {
          console.log(`${entry.threadId}\t${entry.status}`);
        }
      }),
    );
}

function parseItems<T>(
  json: string,
  schema: {
    safeParse(
      value: unknown,
    ):
      | { success: true; data: T }
      | { success: false; error: { message: string } };
  },
): T {
  let items: unknown;
  try {
    items = JSON.parse(json);
  } catch (error) {
    throw new Error(`Invalid items JSON: ${getErrorMessage(error)}`);
  }
  const result = schema.safeParse({ items });
  if (!result.success) {
    throw new Error(`Invalid execution batch: ${result.error.message}`);
  }
  return result.data;
}
