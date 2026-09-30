import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IN_MEMORY_DATABASE_PATH, openDatabase, type DatabaseHandle } from "./client";
import { runMigrations } from "./migrate";

const openHandles: DatabaseHandle[] = [];
const temporaryDirectories: string[] = [];

function createTemporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "auth-db-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

function open(databasePath: string): DatabaseHandle {
  const handle = openDatabase(databasePath);
  openHandles.push(handle);
  return handle;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const handle of openHandles.splice(0)) {
    handle.connection.close();
  }
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("openDatabase (T-UA-11)", () => {
  it("creates the missing parent directory and the database file, with foreign keys and WAL", () => {
    const root = createTemporaryDirectory();
    const databaseFile = path.join(root, "nested", "dir", "app.db");
    expect(fs.existsSync(path.dirname(databaseFile))).toBe(false);

    const { connection } = open(databaseFile);

    expect(fs.existsSync(databaseFile)).toBe(true);
    expect(connection.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(connection.pragma("journal_mode", { simple: true })).toBe("wal");
  });

  it("resolves a relative path against the working directory", () => {
    const root = createTemporaryDirectory();
    vi.spyOn(process, "cwd").mockReturnValue(root);

    open(path.join("data", "app.db"));

    expect(fs.existsSync(path.join(root, "data", "app.db"))).toBe(true);
  });

  it("supports :memory: without touching the file system", () => {
    const { connection } = open(IN_MEMORY_DATABASE_PATH);
    expect(connection.memory).toBe(true);
    expect(connection.pragma("foreign_keys", { simple: true })).toBe(1);
  });
});

describe("runMigrations (T-UA-11)", () => {
  it("creates users, refresh_tokens and password_reset_tokens on a fresh database", () => {
    const { db, connection } = open(IN_MEMORY_DATABASE_PATH);

    runMigrations(db);

    const tables = connection
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_\\_%' ESCAPE '\\' AND name NOT LIKE 'sqlite_%'"
      )
      .all()
      .map((row) => (row as { name: string }).name)
      .sort();
    expect(tables).toEqual(["password_reset_tokens", "refresh_tokens", "users"]);
  });

  it("is idempotent when run twice", () => {
    const { db } = open(IN_MEMORY_DATABASE_PATH);
    runMigrations(db);
    expect(() => runMigrations(db)).not.toThrow();
  });

  it("applies to a file database as the entry point does", () => {
    const root = createTemporaryDirectory();
    const { db, connection } = open(path.join(root, "app.db"));
    runMigrations(db);
    const userTable = connection.prepare("SELECT sql FROM sqlite_master WHERE name = 'users'").get() as { sql: string };
    expect(userTable.sql).toContain("CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL)");
  });
});
