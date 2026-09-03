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
    "packages/sdk/src/core.ts",
    "interface Sdk { p6rMembers: P6rMembersArea; p6rPresence: P6rPresenceArea; }\n",
  );
  write(
    "packages/plugin-sdk/src/app-contract.ts",
    "interface P6rParticipantProfile {}\ninterface App { p6rParticipants?: readonly P6rParticipantProfile[]; }\n",
  );
  write(
    "packages/plugin-sdk/src/backend-contract.ts",
    "interface P6rExperimentalPluginRoutes { p6rThreadPath(args: { projectId: string; threadId: string }): string; }\ninterface Backend { p6rIdentity: P6rIdentityApi; p6rRequestPrincipal: P6rActorSnapshot | null; p6rTurnAuthor: P6rActorSnapshot | null; experimental_p6rRoutes: P6rExperimentalPluginRoutes; }\n",
  );
  write(
    "packages/server-contract/src/thread-timeline.ts",
    "interface TimelineRow { p6rActorHandle: string | null; }\n",
  );
  write(
    "apps/app/src/components/thread/timeline/ConversationMessageContent.tsx",
    "export const presentation = { p6rShowAuthor: true };\n",
  );
  git("add", ".");
  git("commit", "--quiet", "-m", "baseline");
  const base = git("rev-parse", "HEAD").trim();

  write(
    "packages/domain/src/thread-facet.ts",
    "export type ThreadFacetTypeId = string;\n",
  );
  git("add", ".");
  git("commit", "--quiet", "-m", "approved facet surface");
  const approved = runChecker(base);
  if (approved.status !== 0) {
    throw new Error(
      `approved facet surface was rejected:\n${approved.stdout}${approved.stderr}`,
    );
  }

  // The name deliberately contains `Facet`: only the exact approved
  // path/symbol pair above is exempt, never a convenient generic prefix.
  write(
    "packages/domain/src/unrelated-plugin-contract.ts",
    "export type UnrelatedFacetEscape = string;\n",
  );
  git("add", ".");
  git("commit", "--quiet", "-m", "unrelated downstream leak");
  const rejected = runChecker(base);
  if (rejected.status === 0) {
    throw new Error("unrelated non-p6r export unexpectedly passed");
  }
  if (
    !rejected.stderr.includes(
      "new exported symbol 'UnrelatedFacetEscape' is not p6r-prefixed",
    )
  ) {
    throw new Error(`unexpected refusal:\n${rejected.stdout}${rejected.stderr}`);
  }

  write(
    "packages/plugin-sdk/src/backend-contract.ts",
    "interface P6rExperimentalPluginRoutes { p6rThreadPath(args: { projectId: string; threadId: string }): string; }\ninterface Backend { p6rIdentity: P6rIdentityApi; p6rRequestPrincipal: P6rActorSnapshot | null; p6rTurnAuthor: P6rActorSnapshot | null; experimental_p6rRoutes: P6rExperimentalPluginRoutes; experimental_routes: P6rExperimentalPluginRoutes; }\n",
  );
  git("add", ".");
  git("commit", "--quiet", "-m", "unquarantined plugin route member");
  const unquarantined = runChecker(base);
  if (unquarantined.status === 0) {
    throw new Error("unquarantined plugin route member unexpectedly passed");
  }
  if (!unquarantined.stderr.includes("leaked unquarantined downstream member 'experimental_routes'")) {
    throw new Error(`unexpected refusal:\n${unquarantined.stdout}${unquarantined.stderr}`);
  }

  console.log("p6r namespace adversarial witness passed");
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
