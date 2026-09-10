import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DbConnection } from "@bb/db";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(moduleDir, "drizzle");

export function migrateP6rSidecars(db: DbConnection): void {
  migrate(db, {
    migrationsFolder,
    migrationsTable: "__p6r_migrations",
  });
}
