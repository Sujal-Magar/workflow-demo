import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DatabaseHandle } from "../../db/client";
import { TEST_START_TIME, createTestDatabase } from "../../test-support/auth-test-harness";
import { RefreshTokenRepository } from "./refresh-token-repository";
import { UserRepository } from "./user-repository";

const LATER = new Date(TEST_START_TIME.getTime() + 60_000);
const EXPIRES_AT = new Date(TEST_START_TIME.getTime() + 7 * 24 * 3600 * 1000);

let database: DatabaseHandle;
let repository: RefreshTokenRepository;

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
  repository.createRefreshToken({ ...token, userId, expiresAt: EXPIRES_AT, createdAt: TEST_START_TIME });
  return token;
}

beforeEach(() => {
  database = createTestDatabase();
  repository = new RefreshTokenRepository(database.db);
});

afterEach(() => {
  database.connection.close();
});

describe("RefreshTokenRepository (T-UA-03)", () => {
  it("creates a token and finds it by hash", () => {
    const userId = seedUser();
    const token = seedToken(userId);

    expect(repository.findByHash(token.tokenHash)).toEqual({
      id: token.id,
      userId,
      tokenHash: token.tokenHash,
      expiresAt: EXPIRES_AT,
      revokedAt: null,
      createdAt: TEST_START_TIME,
    });
  });

  it("find-by-hash returns null when the hash is unknown", () => {
    expect(repository.findByHash("unknown-hash")).toBeNull();
  });

  it("revokes one token only if it is not revoked yet", () => {
    const token = seedToken(seedUser());

    expect(repository.revokeIfActive(token.id, LATER)).toBe(true);
    expect(repository.revokeIfActive(token.id, new Date(LATER.getTime() + 1000))).toBe(false);
    expect(repository.findByHash(token.tokenHash)?.revokedAt).toEqual(LATER);
  });

  it("revoke-all touches only that user's active tokens", () => {
    const userId = seedUser();
    const otherUserId = seedUser();
    const first = seedToken(userId);
    const second = seedToken(userId);
    const alreadyRevoked = seedToken(userId);
    const otherUsersToken = seedToken(otherUserId);
    repository.revokeIfActive(alreadyRevoked.id, TEST_START_TIME);

    expect(repository.revokeAllForUser(userId, LATER)).toBe(2);

    expect(repository.findByHash(first.tokenHash)?.revokedAt).toEqual(LATER);
    expect(repository.findByHash(second.tokenHash)?.revokedAt).toEqual(LATER);
    expect(repository.findByHash(alreadyRevoked.tokenHash)?.revokedAt).toEqual(TEST_START_TIME);
    expect(repository.findByHash(otherUsersToken.tokenHash)?.revokedAt).toBeNull();
  });

  it("rejects a token for an unknown user (foreign key)", () => {
    expect(() => seedToken(randomUUID())).toThrow(/FOREIGN KEY constraint failed/);
  });
});
