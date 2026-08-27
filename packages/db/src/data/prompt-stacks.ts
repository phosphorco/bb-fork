import {
  p6rPromptStackSettingsSchema,
  type P6rPromptStackSettings,
} from "@bb/domain";
import type { DbConnection } from "../connection.js";
import { appSettingsValues } from "../schema.js";
import { eq } from "drizzle-orm";

const PROMPT_STACK_SETTINGS_KEY = "promptStacks";
const defaultPromptStackSettings: P6rPromptStackSettings = {
  stacks: [],
  projectOverrides: {},
};

export function p6rGetPromptStackSettings(
  db: DbConnection,
): P6rPromptStackSettings {
  const row = db
    .select({ value: appSettingsValues.value })
    .from(appSettingsValues)
    .where(eq(appSettingsValues.key, PROMPT_STACK_SETTINGS_KEY))
    .get();

  if (!row) return defaultPromptStackSettings;

  try {
    const parsed: unknown = JSON.parse(row.value);
    const result = p6rPromptStackSettingsSchema.safeParse(parsed);
    return result.success ? result.data : defaultPromptStackSettings;
  } catch {
    return defaultPromptStackSettings;
  }
}

export function p6rSetPromptStackSettings(
  db: DbConnection,
  settings: P6rPromptStackSettings,
): void {
  const value = JSON.stringify(p6rPromptStackSettingsSchema.parse(settings));
  db.insert(appSettingsValues)
    .values({
      key: PROMPT_STACK_SETTINGS_KEY,
      value,
      updatedAt: Date.now(),
    })
    .onConflictDoUpdate({
      target: appSettingsValues.key,
      set: { value, updatedAt: Date.now() },
    })
    .run();
}
