import type { PluginProviderDeclaration } from "@get-bb/plugin-sdk";

export const CODEX_NATIVE_ROOTS_DECLARATION: Pick<
  PluginProviderDeclaration,
  "experimental_nativeSkillRoots" | "experimental_resolvesNativeRoots"
> = {
  experimental_nativeSkillRoots: {
    user: [".codex/skills", ".agents/skills"],
    project: [".codex/skills", { path: ".agents/skills", ancestors: true }],
  },
  experimental_resolvesNativeRoots: true,
};
