import { defineConfig } from "drizzle-kit";
export default defineConfig({
  dialect: "sqlite",
  out: "apps/server/src/services/p6r/drizzle",
  schema: "apps/server/src/services/p6r/sidecar-schema.ts",
});
