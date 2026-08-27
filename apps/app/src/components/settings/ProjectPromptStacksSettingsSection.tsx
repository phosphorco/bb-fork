import { useEffect, useState } from "react";
import type {
  P6rPromptStackProjectOverride,
  P6rPromptStackStep,
  P6rPromptStackStepOverride,
} from "@bb/domain";
import { Button } from "@bb/shared-ui/button";
import { SettingsSection } from "@/components/ui/settings-section";
import { useP6rUpdateProjectPromptStacks } from "@/hooks/mutations/project-mutations";
import { useP6rProjectPromptStacks } from "@/hooks/queries/project-queries";

type ProjectOverrides = Record<string, P6rPromptStackProjectOverride>;

function withStepOverride(
  overrides: ProjectOverrides,
  stackId: string,
  step: P6rPromptStackStep,
): ProjectOverrides {
  return {
    ...overrides,
    [stackId]: {
      steps: {
        ...(overrides[stackId]?.steps ?? {}),
        [step.id]: {
          agentPrompt: step.agentPrompt,
          operatorComment: step.operatorComment,
        },
      },
    },
  };
}

function withoutStepOverride(
  overrides: ProjectOverrides,
  stackId: string,
  stepId: string,
): ProjectOverrides {
  const stackOverride = overrides[stackId];
  if (!stackOverride) return overrides;
  const { [stepId]: _removed, ...remainingSteps } = stackOverride.steps;
  if (Object.keys(remainingSteps).length === 0) {
    const { [stackId]: _removedStack, ...remainingStacks } = overrides;
    return remainingStacks;
  }
  return { ...overrides, [stackId]: { steps: remainingSteps } };
}

function updateStepField(
  overrides: ProjectOverrides,
  stackId: string,
  stepId: string,
  field: keyof P6rPromptStackStepOverride,
  value: string,
): ProjectOverrides {
  const stackOverride = overrides[stackId];
  const stepOverride = stackOverride?.steps[stepId];
  if (!stackOverride || !stepOverride) return overrides;
  return {
    ...overrides,
    [stackId]: {
      steps: {
        ...stackOverride.steps,
        [stepId]: { ...stepOverride, [field]: value },
      },
    },
  };
}

export function P6rProjectPromptStacksSettingsSection({
  projectId,
}: {
  projectId: string;
}) {
  const query = useP6rProjectPromptStacks(projectId);
  const update = useP6rUpdateProjectPromptStacks();
  const [overrides, setOverrides] = useState<ProjectOverrides>({});
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (query.data !== undefined && !isDirty) {
      setOverrides(query.data.overrides);
    }
  }, [isDirty, query.data]);

  const save = () => {
    update.mutate(
      { projectId, overrides },
      { onSuccess: () => setIsDirty(false) },
    );
  };

  return (
    <SettingsSection
      title="Prompt stack overrides"
      description="Customize individual steps for this project while keeping the global stacks shared."
    >
      {query.data?.effectiveStacks.length ? (
        <div className="space-y-3">
          {query.data.effectiveStacks.map((stack) => {
            const stackOverride = overrides[stack.id];
            return (
              <details
                key={stack.id}
                className="rounded-md border border-border p-3"
              >
                <summary className="cursor-pointer text-sm font-medium">
                  {stack.name}
                  <span className="ml-2 text-xs font-normal text-subtle-foreground">
                    {stack.steps.length} steps
                  </span>
                </summary>
                <div className="mt-3 space-y-4">
                  {stack.steps.map((step, index) => {
                    const stepOverride = stackOverride?.steps[step.id];
                    const checked = stepOverride !== undefined;
                    return (
                      <div
                        key={step.id}
                        className="space-y-2 border-t border-border pt-3 first:border-t-0 first:pt-0"
                      >
                        <label className="flex items-center gap-2 text-xs font-medium">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              setOverrides((current) =>
                                event.target.checked
                                  ? withStepOverride(current, stack.id, step)
                                  : withoutStepOverride(
                                      current,
                                      stack.id,
                                      step.id,
                                    ),
                              );
                              setIsDirty(true);
                            }}
                          />
                          Override step {index + 1}
                        </label>
                        {checked ? (
                          <div className="grid gap-2 pl-6">
                            <textarea
                              className="min-h-20 w-full rounded-md border border-border bg-background p-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
                              value={
                                stepOverride.agentPrompt ?? step.agentPrompt
                              }
                              onChange={(event) => {
                                setOverrides((current) =>
                                  updateStepField(
                                    current,
                                    stack.id,
                                    step.id,
                                    "agentPrompt",
                                    event.target.value,
                                  ),
                                );
                                setIsDirty(true);
                              }}
                              aria-label={`${stack.name} step ${index + 1} agent prompt`}
                            />
                            <textarea
                              className="min-h-12 w-full rounded-md border border-border bg-background p-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
                              value={
                                stepOverride.operatorComment ??
                                step.operatorComment
                              }
                              onChange={(event) => {
                                setOverrides((current) =>
                                  updateStepField(
                                    current,
                                    stack.id,
                                    step.id,
                                    "operatorComment",
                                    event.target.value,
                                  ),
                                );
                                setIsDirty(true);
                              }}
                              aria-label={`${stack.name} step ${index + 1} operator comment`}
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-subtle-foreground">
          No global prompt stacks are configured yet.
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={query.data === undefined || update.isPending || !isDirty}
          onClick={() => {
            setOverrides(query.data?.overrides ?? {});
            setIsDirty(false);
          }}
        >
          Reset
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={query.data === undefined || update.isPending || !isDirty}
          onClick={save}
        >
          {update.isPending ? "Saving…" : "Save project overrides"}
        </Button>
      </div>
    </SettingsSection>
  );
}
