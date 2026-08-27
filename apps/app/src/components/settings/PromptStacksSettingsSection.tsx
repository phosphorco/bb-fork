import { useEffect, useState } from "react";
import { p6rPromptStackCatalogSchema } from "@bb/domain";
import { Button } from "@bb/shared-ui/button";
import { SettingsSection } from "@/components/ui/settings-section";
import { useP6rUpdatePromptStackCatalog } from "@/hooks/mutations/settings-mutations";
import { useP6rSystemPromptStacks } from "@/hooks/queries/system-queries";

const EXAMPLE_PROMPT_STACKS = `{
  "stacks": [
    {
      "id": "finish-work",
      "name": "Finish work",
      "description": "Review, refine, and publish the current work",
      "steps": [
        {
          "id": "reflect",
          "agentPrompt": "What still feels wonky about the work?",
          "operatorComment": "Sets the mindset to reflect on what feels weak or unfinished"
        }
      ]
    }
  ]
}`;

export function P6rPromptStacksSettingsSection() {
  const query = useP6rSystemPromptStacks();
  const update = useP6rUpdatePromptStackCatalog();
  const [value, setValue] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    if (query.data !== undefined && !isDirty) {
      setValue(JSON.stringify(query.data, null, 2));
    }
  }, [isDirty, query.data]);

  const save = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      setParseError("Enter valid JSON.");
      return;
    }
    const result = p6rPromptStackCatalogSchema.safeParse(parsed);
    if (!result.success) {
      setParseError(
        result.error.issues[0]?.message ?? "Invalid prompt stacks.",
      );
      return;
    }
    setParseError(null);
    update.mutate(result.data, { onSuccess: () => setIsDirty(false) });
  };

  return (
    <SettingsSection
      title="Prompt stacks"
      description="Configure reusable multi-step follow-up workflows. Type / in a follow-up editor to run one."
    >
      <p className="mb-2 text-xs text-subtle-foreground">
        Each step has an agent prompt and an operator-only comment. Use the
        example below as a starting point.
      </p>
      <textarea
        className="min-h-64 w-full rounded-md border border-border bg-background p-3 font-mono text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
        value={value}
        placeholder={EXAMPLE_PROMPT_STACKS}
        onChange={(event) => {
          setValue(event.target.value);
          setIsDirty(true);
          setParseError(null);
        }}
        spellCheck={false}
        aria-label="Global prompt stacks JSON"
      />
      {parseError ? (
        <p className="mt-2 text-xs text-destructive">{parseError}</p>
      ) : null}
      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          size="sm"
          disabled={query.data === undefined || update.isPending || !isDirty}
          onClick={save}
        >
          {update.isPending ? "Saving…" : "Save global stacks"}
        </Button>
      </div>
    </SettingsSection>
  );
}
