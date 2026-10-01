import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import type { AppDatabase } from "./client";

export const MIGRATIONS_FOLDER = path.join(__dirname, "migrations");

/** Applies every pending migration. Used by the entry point and by the test harness alike. */
export function runMigrations(db: AppDatabase): void {
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
