import { z } from "zod";

const promptStackIdPattern = /^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/u;

export const p6rPromptStackIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(promptStackIdPattern, "Use lowercase letters, numbers, - or _");

export const p6rPromptStackStepIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(promptStackIdPattern, "Use lowercase letters, numbers, - or _");

export const p6rPromptStackStepSchema = z
  .object({
    id: p6rPromptStackStepIdSchema,
    agentPrompt: z.string().trim().min(1).max(20_000),
    operatorComment: z.string().max(20_000),
  })
  .strict();

export type P6rPromptStackStep = z.infer<typeof p6rPromptStackStepSchema>;

export const p6rPromptStackSchema = z
  .object({
    id: p6rPromptStackIdSchema,
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(400),
    steps: z.array(p6rPromptStackStepSchema).min(1).max(50),
  })
  .strict()
  .superRefine((stack, context) => {
    const ids = new Set<string>();
    for (const [index, step] of stack.steps.entries()) {
      if (ids.has(step.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps", index, "id"],
          message: "Step ids must be unique within a prompt stack",
        });
      }
      ids.add(step.id);
    }
  });

export type P6rPromptStack = z.infer<typeof p6rPromptStackSchema>;

export const p6rPromptStackStepOverrideSchema = z
  .object({
    agentPrompt: z.string().trim().min(1).max(20_000).optional(),
    operatorComment: z.string().max(20_000).optional(),
  })
  .strict()
  .refine(
    (override) =>
      override.agentPrompt !== undefined ||
      override.operatorComment !== undefined,
    { message: "An override must change a prompt or operator comment" },
  );

export type P6rPromptStackStepOverride = z.infer<
  typeof p6rPromptStackStepOverrideSchema
>;

export const p6rPromptStackProjectOverrideSchema = z
  .object({
    steps: z.record(
      p6rPromptStackStepIdSchema,
      p6rPromptStackStepOverrideSchema,
    ),
  })
  .strict();

export type P6rPromptStackProjectOverride = z.infer<
  typeof p6rPromptStackProjectOverrideSchema
>;

export const p6rPromptStackSettingsSchema = z
  .object({
    stacks: z.array(p6rPromptStackSchema).max(100),
    projectOverrides: z
      .record(
        z.string().min(1),
        z.record(p6rPromptStackIdSchema, p6rPromptStackProjectOverrideSchema),
      )
      .default({}),
  })
  .strict();

export type P6rPromptStackSettings = z.infer<
  typeof p6rPromptStackSettingsSchema
>;

export const p6rPromptStackCatalogSchema = z
  .object({
    stacks: z.array(p6rPromptStackSchema).max(100),
  })
  .strict();

export type P6rPromptStackCatalog = z.infer<typeof p6rPromptStackCatalogSchema>;

export function p6rResolvePromptStacks(
  settings: P6rPromptStackSettings,
  projectId: string,
): P6rPromptStack[] {
  const projectOverrides = settings.projectOverrides[projectId] ?? {};
  return settings.stacks.map((stack) => {
    const stackOverride = projectOverrides[stack.id];
    if (!stackOverride) return stack;

    return {
      ...stack,
      steps: stack.steps.map((step) => {
        const override = stackOverride.steps[step.id];
        return override ? { ...step, ...override } : step;
      }),
    };
  });
}
