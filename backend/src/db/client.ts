import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { RunResult } from "better-sqlite3";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import * as schema from "./schema";

export const IN_MEMORY_DATABASE_PATH = ":memory:";

export type DatabaseSchema = typeof schema;

export type AppDatabase = BetterSQLite3Database<DatabaseSchema>;

/** Either the database itself or a transaction on it; repositories accept both. */
export type DatabaseExecutor = BaseSQLiteDatabase<"sync", RunResult, DatabaseSchema>;

export interface DatabaseHandle {
  readonly db: AppDatabase;
  /** The underlying better-sqlite3 connection, for pragmas and closing. */
  readonly connection: Database.Database;
}

function resolveDatabaseFile(databasePath: string): string {
  if (databasePath === IN_MEMORY_DATABASE_PATH) {
    return databasePath;
  }
  const absolutePath = path.resolve(process.cwd(), databasePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  return absolutePath;
}

/**
 * Opens the SQLite database at `databasePath` (resolved against the working directory, parent
 * directory created if missing), or an in-memory database for `:memory:`.
 */
export function openDatabase(databasePath: string): DatabaseHandle {
  const connection = new Database(resolveDatabaseFile(databasePath));
  connection.pragma("foreign_keys = ON");
  connection.pragma("journal_mode = WAL");
  return { db: drizzle(connection, { schema }), connection };
}
