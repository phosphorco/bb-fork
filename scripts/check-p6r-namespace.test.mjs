import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const fixture = mkdtempSync(join(tmpdir(), "bb-p6r-namespace-"));
const checker = resolve(import.meta.dirname, "check-p6r-namespace");

function git(...args) {
  return execFileSync("git", args, { cwd: fixture, encoding: "utf8" });
}

function write(path, contents) {
  const target = join(fixture, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

function runChecker(base) {
  return spawnSync(process.execPath, [checker, fixture, base], {
    encoding: "utf8",
  });
}

try {
  git("init", "--quiet");
  git("config", "user.name", "Namespace Policy Test");
  git("config", "user.email", "namespace-policy@example.invalid");
  write(
    "packages/plugin-sdk/src/backend-contract.ts",
    "interface Backend { experimental_p6rIdentity?: ExperimentalP6rIdentityProtocol; }\n",
  );
  write(
    "packages/plugin-sdk/src/experimental-p6r-identity.ts",
    "export interface ExperimentalP6rIdentityProtocol {}\nexport interface ExperimentalP6rInvocationContext {}\n",
  );
  write(
    "apps/server/src/services/p6r/identity-protocol.ts",
    "export interface P6rActorSnapshot {}\nexport function createP6rIdentityService() {}\n",
  );
  git("add", ".");
  git("commit", "--quiet", "-m", "baseline");
  const base = git("rev-parse", "HEAD").trim();

  write(
    "apps/server/src/services/p6r/provider-admission.ts",
    "export function createP6rProviderAdmission() {}\n",
  );
  git("add", ".");
  git("commit", "--quiet", "-m", "namespaced addition");
  const approved = runChecker(base);
  if (approved.status !== 0) {
    throw new Error(
      `namespaced identity surface was rejected:\n${approved.stdout}${approved.stderr}`,
    );
  }

  write(
    "apps/server/src/services/p6r/provider-admission.ts",
    "export function createProviderAdmission() {}\n",
  );
  git("add", ".");
  git("commit", "--quiet", "-m", "unprefixed identity export");
  const rejected = runChecker(base);
  if (rejected.status === 0) {
    throw new Error("unprefixed identity export unexpectedly passed");
  }
  if (!rejected.stderr.includes("does not contain the p6r namespace")) {
    throw new Error(`unexpected refusal:\n${rejected.stdout}${rejected.stderr}`);
  }

  console.log("p6r namespace adversarial witness passed");
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
