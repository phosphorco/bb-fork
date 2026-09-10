import type {
  NativeActorSnapshot,
  NativeInputProvenanceGroup,
  NativeOrigin,
  PromptInput,
} from "@bb/domain";

const MAX_LABEL_LENGTH = 160;
const MAX_GROUP_SOURCES = 4;

function labelText(value: string): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  const bounded = normalized.slice(0, MAX_LABEL_LENGTH);
  return JSON.stringify(bounded);
}

function actorLabel(actor: NativeActorSnapshot): string {
  if (actor.identity.kind === "external") {
    return `external source ${labelText(actor.identity.pluginId)}`;
  }
  return `person ${labelText(actor.presentation.displayName)}`;
}

function originLabel(origin: NativeOrigin): string {
  switch (origin.kind) {
    case "person":
      return actorLabel(origin.actor);
    case "external":
      return actorLabel(origin.actor);
    case "agent":
      return origin.agentId === null
        ? "agent"
        : `agent ${labelText(origin.agentId)}`;
    case "system":
      return `system ${labelText(origin.reason)}`;
    case "unknown":
      return `unknown source ${labelText(origin.reason)}`;
  }
}

function sourceLabel(group: NativeInputProvenanceGroup): string | null {
  if (group.sources.length === 0) return null;
  const labels = group.sources.slice(0, MAX_GROUP_SOURCES).map((source) => {
    const author = originLabel(source.attribution.author);
    const editor = source.attribution.latestEditor;
    return editor === null
      ? author
      : `${author}; edited by ${actorLabel(editor)}`;
  });
  if (group.sources.length > MAX_GROUP_SOURCES) {
    labels.push(`and ${group.sources.length - MAX_GROUP_SOURCES} more sources`);
  }
  return `[BB input source: ${labels.join(" | ")}]`;
}

export function formatPromptInputForProvider(
  input: readonly PromptInput[],
  inputGroups: readonly (readonly PromptInput[])[] | undefined,
  provenanceGroups: readonly NativeInputProvenanceGroup[] | undefined,
): PromptInput[] {
  if (provenanceGroups === undefined) return [...input];
  if (
    inputGroups === undefined ||
    inputGroups.length !== provenanceGroups.length
  ) {
    throw new Error(
      "Provider input provenance does not align with input groups",
    );
  }
  const formatted: PromptInput[] = [];
  for (const [groupIndex, group] of inputGroups.entries()) {
    const provenance = provenanceGroups[groupIndex];
    if (provenance === undefined || provenance.groupIndex !== groupIndex) {
      throw new Error(
        "Provider input provenance does not preserve input group order",
      );
    }
    if (groupIndex > 0) {
      // ACP providers delimit adjacent text blocks with a newline when they
      // serialize them. One explicit newline therefore preserves the intended
      // blank line between labeled provenance groups without adding a second.
      formatted.push({ type: "text", text: "\n", mentions: [] });
    }
    const label = sourceLabel(provenance);
    if (label !== null) {
      formatted.push({ type: "text", text: label, mentions: [] });
    }
    formatted.push(...group);
  }
  return formatted;
}
