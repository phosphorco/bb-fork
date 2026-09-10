import type { PluginProviderDeclaration } from "@get-bb/plugin-sdk";

export const CLAUDE_NATIVE_ROOTS_DECLARATION: Pick<
  PluginProviderDeclaration,
  | "experimental_nativeSkillRoots"
  | "experimental_nativeCommandRoots"
  | "experimental_resolvesNativeRoots"
> = {
  experimental_nativeSkillRoots: {
    user: [
      { path: ".claude/skills", skipIfManifest: ".claude-plugin/plugin.json" },
    ],
    project: [
      {
        path: ".claude/skills",
        ancestors: true,
        skipIfManifest: ".claude-plugin/plugin.json",
      },
    ],
  },
  experimental_nativeCommandRoots: {
    project: [".claude/commands"],
  },
  experimental_resolvesNativeRoots: true,
};
