import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DatabaseHandle } from "../../db/client";
import { users } from "../../db/schema";
import { TEST_START_TIME, createTestDatabase } from "../../test-support/auth-test-harness";
import { UserRepository, type NewUser } from "./user-repository";

let database: DatabaseHandle;
let repository: UserRepository;

function newUser(overrides: Partial<NewUser> = {}): NewUser {
  return {
    id: randomUUID(),
    name: "Test User",
    email: `${randomUUID()}@example.com`,
    passwordHash: "$argon2id$hash",
    provider: "email",
    googleId: null,
    createdAt: TEST_START_TIME,
    ...overrides,
  };
}

beforeEach(() => {
  database = createTestDatabase();
  repository = new UserRepository(database.db);
});

afterEach(() => {
  database.connection.close();
});

describe("UserRepository (T-UA-03)", () => {
  it("creates a user and finds it by id, email and Google ID", () => {
    const input = newUser({ googleId: "google-1" });
    const created = repository.createUser(input);

    expect(created.status).toBe("created");
    expect(repository.findById(input.id)).toEqual({
      id: input.id,
      name: input.name,
      email: input.email,
      passwordHash: input.passwordHash,
      provider: "email",
      googleId: "google-1",
      createdAt: TEST_START_TIME,
      updatedAt: TEST_START_TIME,
    });
    expect(repository.findByEmail(input.email)?.id).toBe(input.id);
    expect(repository.findByGoogleId("google-1")?.id).toBe(input.id);
  });

  it("returns null for unknown id, email and Google ID", () => {
    expect(repository.findById(randomUUID())).toBeNull();
    expect(repository.findByEmail("nobody@example.com")).toBeNull();
    expect(repository.findByGoogleId("google-unknown")).toBeNull();
  });

  it('reports a duplicate email as "email taken" instead of throwing', () => {
    const first = newUser();
    repository.createUser(first);

    const duplicate = repository.createUser(newUser({ email: first.email }));

    expect(duplicate).toEqual({ status: "email-taken" });
    expect(database.db.select().from(users).all()).toHaveLength(1);
  });

  it("enforces google_id uniqueness (thrown, not reported as email taken)", () => {
    repository.createUser(newUser({ googleId: "google-dup" }));
    expect(() => repository.createUser(newUser({ googleId: "google-dup" }))).toThrow(
      /UNIQUE constraint failed: users.google_id/
    );
  });

  it("the check constraint rejects a row with neither a password hash nor a Google ID", () => {
    expect(() => repository.createUser(newUser({ passwordHash: null, googleId: null }))).toThrow(
      /CHECK constraint failed/
    );
    expect(database.db.select().from(users).all()).toHaveLength(0);
  });

  it("accepts a Google-only row with no password hash", () => {
    const created = repository.createUser(newUser({ passwordHash: null, googleId: "google-only", provider: "google" }));
    expect(created.status).toBe("created");
  });

  it("links a Google ID and bumps updated_at", () => {
    const input = newUser();
    repository.createUser(input);
    const later = new Date(TEST_START_TIME.getTime() + 60_000);

    repository.linkGoogleId(input.id, "google-link", later);

    const stored = repository.findById(input.id);
    expect(stored?.googleId).toBe("google-link");
    expect(stored?.updatedAt).toEqual(later);
    expect(stored?.createdAt).toEqual(TEST_START_TIME);
  });

  it("updates the password hash and bumps updated_at", () => {
    const input = newUser();
    repository.createUser(input);
    const later = new Date(TEST_START_TIME.getTime() + 60_000);

    repository.updatePasswordHash(input.id, "$argon2id$new", later);

    const stored = repository.findById(input.id);
    expect(stored?.passwordHash).toBe("$argon2id$new");
    expect(stored?.updatedAt).toEqual(later);
  });
});
