import {
  chmodSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { p6rResolveCodexAppServerLaunch } from "./app-server-launch.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

it("selects the stable launcher before and after replacement of the PATH shim", () => {
  const root = mkdtempSync(join(tmpdir(), "codex-launch-policy-"));
  roots.push(root);
  const launcher = join(root, "router-command");
  const shim = join(root, "codex");
  writeFileSync(launcher, "#!/bin/sh\nexit 0\n");
  chmodSync(launcher, 0o700);
  symlinkSync(launcher, shim);
  const env = { PATH: root, CODEX_APP_SERVER_EXECUTABLE: launcher };
  expect(p6rResolveCodexAppServerLaunch(env)).toEqual({
    command: launcher,
    args: ["app-server"],
  });
  unlinkSync(shim);
  symlinkSync(process.execPath, shim);
  expect(p6rResolveCodexAppServerLaunch(env)).toEqual({
    command: launcher,
    args: ["app-server"],
  });
  unlinkSync(launcher);
  expect(() => p6rResolveCodexAppServerLaunch(env)).toThrow(
    "Refusing PATH fallback",
  );
});

it("rejects empty, relative, directory and non-executable policy targets", () => {
  const root = mkdtempSync(join(tmpdir(), "codex-launch-invalid-"));
  roots.push(root);
  const file = join(root, "not-executable");
  writeFileSync(file, "data");
  chmodSync(file, 0o600);
  for (const path of ["", "codex", root, file]) {
    expect(() =>
      p6rResolveCodexAppServerLaunch({ CODEX_APP_SERVER_EXECUTABLE: path }),
    ).toThrow();
  }
});

it("retains PATH defaults only when host policy is absent", () => {
  expect(p6rResolveCodexAppServerLaunch({})).toEqual({
    command: "codex",
    args: ["app-server"],
  });
  expect(
    p6rResolveCodexAppServerLaunch({
      BB_CODEX_BRIDGE_APP_SERVER_COMMAND: "fixture",
      BB_CODEX_BRIDGE_APP_SERVER_ARGS: '["test"]',
    }),
  ).toEqual({ command: "fixture", args: ["test"] });
});
