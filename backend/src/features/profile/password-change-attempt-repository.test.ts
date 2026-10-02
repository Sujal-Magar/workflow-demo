import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DatabaseHandle } from "../../db/client";
import { TEST_START_TIME, createTestDatabase } from "../../test-support/auth-test-harness";
import { UserRepository, type NewUser } from "../auth/user-repository";
import { PasswordChangeAttemptRepository } from "./password-change-attempt-repository";

const FIFTEEN_MINUTES_MS = 15 * 60_000;

let database: DatabaseHandle;
let userRepository: UserRepository;
let repository: PasswordChangeAttemptRepository;
let userId: string;

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
  userRepository = new UserRepository(database.db);
  repository = new PasswordChangeAttemptRepository(database.db);
  const user = newUser();
  userRepository.createUser(user);
  userId = user.id;
});

afterEach(() => {
  database.connection.close();
});

/** `now` is the attempt time; `since` is `now - 15min` — the window used by `ProfileService.changePassword`. */
const now = new Date(TEST_START_TIME.getTime() + 60 * FIFTEEN_MINUTES_MS);
const since = new Date(now.getTime() - FIFTEEN_MINUTES_MS);

describe("PasswordChangeAttemptRepository.countFailuresSince (T-UA-02, D-17)", () => {
  it("zero rows recorded → 0", () => {
    expect(repository.countFailuresSince(userId, since)).toBe(0);
  });

  it("a failure recorded just inside the window (14 min 59 sec old) counts", () => {
    const attemptedAt = new Date(now.getTime() - (14 * 60_000 + 59_000));
    repository.recordFailure(randomUUID(), userId, attemptedAt);

    expect(repository.countFailuresSince(userId, since)).toBe(1);
  });

  it("a failure recorded just outside the window (15 min 1 sec old) does not count", () => {
    const attemptedAt = new Date(now.getTime() - (15 * 60_000 + 1000));
    repository.recordFailure(randomUUID(), userId, attemptedAt);

    expect(repository.countFailuresSince(userId, since)).toBe(0);
  });

  it("a failure recorded exactly 15:00 old does not count (exclusive boundary, D-17)", () => {
    const attemptedAt = since;
    repository.recordFailure(randomUUID(), userId, attemptedAt);

    expect(repository.countFailuresSince(userId, since)).toBe(0);
  });

  it("only counts failures for the given user", () => {
    const otherUser = newUser();
    userRepository.createUser(otherUser);
    repository.recordFailure(randomUUID(), otherUser.id, new Date(now.getTime() - 60_000));

    expect(repository.countFailuresSince(userId, since)).toBe(0);
  });
});
