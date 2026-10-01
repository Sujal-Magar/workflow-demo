import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DatabaseHandle } from "../../db/client";
import { TEST_START_TIME, createTestDatabase } from "../../test-support/auth-test-harness";
import { PasswordResetTokenRepository } from "./password-reset-token-repository";
import { UserRepository } from "./user-repository";

const LATER = new Date(TEST_START_TIME.getTime() + 60_000);
const EXPIRES_AT = new Date(TEST_START_TIME.getTime() + 30 * 60_000);

let database: DatabaseHandle;
let repository: PasswordResetTokenRepository;

function seedUser(): string {
  const id = randomUUID();
  new UserRepository(database.db).createUser({
    id,
    name: "Test User",
    email: `${id}@example.com`,
    passwordHash: "$argon2id$hash",
    provider: "email",
    googleId: null,
    createdAt: TEST_START_TIME,
  });
  return id;
}

function seedToken(userId: string): { id: string; tokenHash: string } {
  const token = { id: randomUUID(), tokenHash: randomUUID() };
  repository.createResetToken({ ...token, userId, expiresAt: EXPIRES_AT, createdAt: TEST_START_TIME });
  return token;
}

beforeEach(() => {
  database = createTestDatabase();
  repository = new PasswordResetTokenRepository(database.db);
});

afterEach(() => {
  database.connection.close();
});

describe("PasswordResetTokenRepository (T-UA-03)", () => {
  it("creates a token and finds it by hash", () => {
    const userId = seedUser();
    const token = seedToken(userId);

    expect(repository.findByHash(token.tokenHash)).toEqual({
      id: token.id,
      userId,
      tokenHash: token.tokenHash,
      expiresAt: EXPIRES_AT,
      usedAt: null,
      createdAt: TEST_START_TIME,
    });
  });

  it("find-by-hash returns null when the hash is unknown", () => {
    expect(repository.findByHash("unknown-hash")).toBeNull();
  });

  it("marks a token used only if it is still unused", () => {
    const token = seedToken(seedUser());

    expect(repository.markUsedIfUnused(token.id, LATER)).toBe(true);
    expect(repository.markUsedIfUnused(token.id, new Date(LATER.getTime() + 1000))).toBe(false);
    expect(repository.findByHash(token.tokenHash)?.usedAt).toEqual(LATER);
  });

  it("invalidate-unused leaves used tokens' used_at unchanged and other users untouched", () => {
    const userId = seedUser();
    const otherUserId = seedUser();
    const used = seedToken(userId);
    const unused = seedToken(userId);
    const otherUsersToken = seedToken(otherUserId);
    repository.markUsedIfUnused(used.id, TEST_START_TIME);

    expect(repository.invalidateUnusedForUser(userId, LATER)).toBe(1);

    expect(repository.findByHash(used.tokenHash)?.usedAt).toEqual(TEST_START_TIME);
    expect(repository.findByHash(unused.tokenHash)?.usedAt).toEqual(LATER);
    expect(repository.findByHash(otherUsersToken.tokenHash)?.usedAt).toBeNull();
  });
});
