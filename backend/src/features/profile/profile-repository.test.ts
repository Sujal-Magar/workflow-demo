import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DatabaseHandle } from "../../db/client";
import { TEST_START_TIME, createTestDatabase } from "../../test-support/auth-test-harness";
import { UserRepository, type NewUser } from "../auth/user-repository";
import { ProfileRepository, type NewProfile, type ProfilePatch } from "./profile-repository";

let database: DatabaseHandle;
let userRepository: UserRepository;
let repository: ProfileRepository;

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

/** Creates a `users` row (FK target) and returns its id, since `user_profiles.user_id` references it. */
function createUser(): string {
  const user = newUser();
  userRepository.createUser(user);
  return user.id;
}

function newProfile(userId: string, overrides: Partial<NewProfile> = {}): NewProfile {
  return { id: randomUUID(), userId, createdAt: TEST_START_TIME, ...overrides };
}

beforeEach(() => {
  database = createTestDatabase();
  userRepository = new UserRepository(database.db);
  repository = new ProfileRepository(database.db);
});

afterEach(() => {
  database.connection.close();
});

describe("ProfileRepository (T-UA-01)", () => {
  it("findByUserId returns null when no profile exists", () => {
    const userId = createUser();
    expect(repository.findByUserId(userId)).toBeNull();
  });

  it("findByUserId finds a created profile", () => {
    const userId = createUser();
    const created = repository.create(newProfile(userId));
    expect(repository.findByUserId(userId)).toEqual(created);
  });

  it("create applies baseline defaults, only id/userId/createdAt explicit", () => {
    const userId = createUser();
    const input = newProfile(userId);

    const created = repository.create(input);

    expect(created).toEqual({
      id: input.id,
      userId,
      avatarUrl: null,
      preferredCurrency: "NPR",
      language: "en_US",
      monthlyStartDate: 1,
      notificationBudgetLimitAlerts: true,
      notificationGoalReminders: true,
      notificationWeeklySummaryEmails: true,
      createdAt: TEST_START_TIME,
      updatedAt: TEST_START_TIME,
    });
  });

  it("update changes only avatarUrl, leaving notification flags and read-only fields untouched", () => {
    const userId = createUser();
    repository.create(newProfile(userId));
    const later = new Date(TEST_START_TIME.getTime() + 60_000);

    const updated = repository.update(userId, { avatarUrl: "https://example.com/me.png" }, later);

    expect(updated.avatarUrl).toBe("https://example.com/me.png");
    expect(updated.notificationBudgetLimitAlerts).toBe(true);
    expect(updated.notificationGoalReminders).toBe(true);
    expect(updated.notificationWeeklySummaryEmails).toBe(true);
    expect(updated.preferredCurrency).toBe("NPR");
    expect(updated.language).toBe("en_US");
    expect(updated.monthlyStartDate).toBe(1);
    expect(updated.updatedAt).toEqual(later);
  });

  it("update changes only the one notification flag passed, leaving the other two and avatarUrl untouched", () => {
    const userId = createUser();
    repository.create(newProfile(userId));
    repository.update(userId, { avatarUrl: "https://example.com/first.png" }, TEST_START_TIME);
    const later = new Date(TEST_START_TIME.getTime() + 120_000);

    const patch: ProfilePatch = { notificationGoalReminders: false };
    const updated = repository.update(userId, patch, later);

    expect(updated.notificationGoalReminders).toBe(false);
    expect(updated.notificationBudgetLimitAlerts).toBe(true);
    expect(updated.notificationWeeklySummaryEmails).toBe(true);
    expect(updated.avatarUrl).toBe("https://example.com/first.png");
  });

  it("resetToDefaults restores baseline defaults and preserves id/createdAt", () => {
    const userId = createUser();
    const created = repository.create(newProfile(userId));
    repository.update(
      userId,
      {
        avatarUrl: "https://example.com/changed.png",
        notificationBudgetLimitAlerts: false,
        notificationGoalReminders: false,
        notificationWeeklySummaryEmails: false,
      },
      new Date(TEST_START_TIME.getTime() + 60_000)
    );
    const resetAt = new Date(TEST_START_TIME.getTime() + 120_000);

    const reset = repository.resetToDefaults(userId, resetAt);

    expect(reset).toEqual({
      id: created.id,
      userId,
      avatarUrl: null,
      preferredCurrency: "NPR",
      language: "en_US",
      monthlyStartDate: 1,
      notificationBudgetLimitAlerts: true,
      notificationGoalReminders: true,
      notificationWeeklySummaryEmails: true,
      createdAt: TEST_START_TIME,
      updatedAt: resetAt,
    });
  });

  it("enforces a unique constraint on user_id", () => {
    const userId = createUser();
    repository.create(newProfile(userId));

    expect(() => repository.create(newProfile(userId))).toThrow(/UNIQUE constraint failed/);
  });
});
