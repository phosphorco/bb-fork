import { accessSync, constants, statSync } from "node:fs";
import { isAbsolute } from "node:path";
import { z } from "zod";

/** Host policy, independent of PATH and version-manager shim ownership. */
const CODEX_APP_SERVER_EXECUTABLE = "CODEX_APP_SERVER_EXECUTABLE";

export function p6rResolveCodexAppServerLaunch(env: NodeJS.ProcessEnv): {
  command: string;
  args: string[];
} {
  const selected = env[CODEX_APP_SERVER_EXECUTABLE];
  if (selected !== undefined) {
    if (!isAbsolute(selected))
      throw new Error(
        `${CODEX_APP_SERVER_EXECUTABLE} must be an absolute executable path`,
      );
    try {
      accessSync(selected, constants.X_OK);
      if (!statSync(selected).isFile()) throw new Error("not a file");
    } catch (cause) {
      throw new Error(
        `Configured Codex app-server launcher is unavailable: ${selected}. Refusing PATH fallback.`,
        { cause },
      );
    }
    return { command: selected, args: ["app-server"] };
  }
  // Existing test-only seam remains isolated from the declared host policy.
  const command = env.BB_CODEX_BRIDGE_APP_SERVER_COMMAND;
  if (!command) return { command: "codex", args: ["app-server"] };
  const rawArgs = env.BB_CODEX_BRIDGE_APP_SERVER_ARGS;
  return {
    command,
    args: rawArgs ? z.array(z.string()).parse(JSON.parse(rawArgs)) : [],
  };
}
