import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DatabaseHandle } from "../../db/client";
import { STRONG_PASSWORD, TestClock, createTestConfig, createTestDatabase } from "../../test-support/auth-test-harness";
import { InvalidCredentialsError } from "../auth/auth-errors";
import { AuthPersistence } from "../auth/auth-persistence";
import { Argon2PasswordHasher } from "../auth/ports/password-hasher";
import type { UserProvider } from "../auth/user-repository";
import {
  PasswordNotSetError,
  PasswordsDoNotMatchError,
  RateLimitExceededError,
  SamePasswordError,
} from "./profile-errors";
import { ProfilePersistence } from "./profile-persistence";
import { ProfileService } from "./profile-service";

const FIFTEEN_MINUTES_MS = 15 * 60_000;
const OTHER_PASSWORD = "zyxwvut9?";

interface ProfileTestContext {
  readonly database: DatabaseHandle;
  readonly clock: TestClock;
  readonly authPersistence: AuthPersistence;
  readonly profilePersistence: ProfilePersistence;
  readonly passwordHasher: Argon2PasswordHasher;
  readonly profileService: ProfileService;
}

interface NewTestUser {
  readonly name?: string;
  readonly email?: string;
  readonly password?: string | null;
  readonly provider?: UserProvider;
  readonly googleId?: string | null;
}

function createProfileTestContext(): ProfileTestContext {
  const database = createTestDatabase();
  const config = createTestConfig();
  const clock = new TestClock();
  const authPersistence = new AuthPersistence(database.db);
  const profilePersistence = new ProfilePersistence(database.db);
  const passwordHasher = new Argon2PasswordHasher(config.passwordHashingCost);
  const profileService = new ProfileService({ profilePersistence, authPersistence, passwordHasher, clock });
  return { database, clock, authPersistence, profilePersistence, passwordHasher, profileService };
}

async function createUser(context: ProfileTestContext, overrides: NewTestUser = {}): Promise<string> {
  const id = randomUUID();
  const password = overrides.password === null ? null : (overrides.password ?? STRONG_PASSWORD);
  const passwordHash = password === null ? null : await context.passwordHasher.hash(password);
  context.authPersistence.users.createUser({
    id,
    name: overrides.name ?? "Jane Doe",
    email: overrides.email ?? `${id}@example.com`,
    passwordHash,
    provider: overrides.provider ?? "email",
    googleId: overrides.googleId ?? null,
    createdAt: context.clock.now(),
  });
  return id;
}

let context: ProfileTestContext;

beforeEach(() => {
  context = createProfileTestContext();
});

afterEach(() => {
  context.database.connection.close();
});

describe("ProfileService.getProfile (T-UA-03)", () => {
  it("creates baseline defaults on first call", async () => {
    const userId = await createUser(context);

    const profile = await context.profileService.getProfile(userId);

    expect(profile.avatarUrl).toBeNull();
    expect(profile.preferredCurrency).toBe("NPR");
    expect(profile.language).toBe("en_US");
    expect(profile.monthlyStartDate).toBe(1);
    expect(profile.notificationPreferences).toEqual({
      budgetLimitAlerts: true,
      goalReminders: true,
      weeklySummaryEmails: true,
    });
  });

  it("returns the same row on a second call (no re-creation)", async () => {
    const userId = await createUser(context);

    const first = await context.profileService.getProfile(userId);
    const second = await context.profileService.getProfile(userId);

    expect(second.createdAt).toBe(first.createdAt);
    expect(context.profilePersistence.profiles.findByUserId(userId)).not.toBeNull();
  });

  it("returned id equals the user id (D-04)", async () => {
    const userId = await createUser(context);

    const profile = await context.profileService.getProfile(userId);

    expect(profile.id).toBe(userId);
  });
});

describe("ProfileService.updateProfile (T-UA-04)", () => {
  it("updating only avatarUrl leaves name and notifications unchanged", async () => {
    const userId = await createUser(context, { name: "Original Name" });
    await context.profileService.getProfile(userId);

    const updated = await context.profileService.updateProfile(userId, { avatarUrl: "https://example.com/a.png" });

    expect(updated.avatarUrl).toBe("https://example.com/a.png");
    expect(updated.name).toBe("Original Name");
    expect(updated.notificationPreferences).toEqual({
      budgetLimitAlerts: true,
      goalReminders: true,
      weeklySummaryEmails: true,
    });
  });

  it("updating only name leaves avatarUrl and notifications unchanged", async () => {
    const userId = await createUser(context, { name: "Original Name" });
    await context.profileService.updateProfile(userId, { avatarUrl: "https://example.com/b.png" });

    const updated = await context.profileService.updateProfile(userId, { name: "New Name" });

    expect(updated.name).toBe("New Name");
    expect(updated.avatarUrl).toBe("https://example.com/b.png");
    expect(updated.notificationPreferences).toEqual({
      budgetLimitAlerts: true,
      goalReminders: true,
      weeklySummaryEmails: true,
    });
  });

  it("updating one notification key leaves the other two unchanged", async () => {
    const userId = await createUser(context);
    await context.profileService.getProfile(userId);

    const updated = await context.profileService.updateProfile(userId, {
      notificationPreferences: { goalReminders: false },
    });

    expect(updated.notificationPreferences).toEqual({
      budgetLimitAlerts: true,
      goalReminders: false,
      weeklySummaryEmails: true,
    });
  });

  it("preferredCurrency/language/monthlyStartDate are never read from input, even if present (D-05)", async () => {
    const userId = await createUser(context);
    await context.profileService.getProfile(userId);

    // `UpdateProfileInput` has no such fields; simulates a loose caller sending them anyway.
    const looseInput = {
      avatarUrl: "https://example.com/c.png",
      preferredCurrency: "USD",
      language: "fr",
      monthlyStartDate: 15,
    };
    const updated = await context.profileService.updateProfile(userId, looseInput);

    expect(updated.preferredCurrency).toBe("NPR");
    expect(updated.language).toBe("en_US");
    expect(updated.monthlyStartDate).toBe(1);
  });
});

describe("ProfileService.changePassword (T-UA-05)", () => {
  it("wrong currentPassword → InvalidCredentialsError, and the failure is recorded", async () => {
    const userId = await createUser(context);

    await expect(
      context.profileService.changePassword(userId, {
        currentPassword: "wrong-pass1!",
        newPassword: OTHER_PASSWORD,
        confirmPassword: OTHER_PASSWORD,
      })
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(
      context.profilePersistence.passwordChangeAttempts.countFailuresSince(
        userId,
        new Date(context.clock.now().getTime() - FIFTEEN_MINUTES_MS)
      )
    ).toBe(1);
  });

  it("Google-SSO account with no password → PasswordNotSetError, no failure recorded", async () => {
    const userId = await createUser(context, { password: null, provider: "google", googleId: "g-1" });

    await expect(
      context.profileService.changePassword(userId, {
        currentPassword: "anything1!",
        newPassword: OTHER_PASSWORD,
        confirmPassword: OTHER_PASSWORD,
      })
    ).rejects.toBeInstanceOf(PasswordNotSetError);

    expect(
      context.profilePersistence.passwordChangeAttempts.countFailuresSince(
        userId,
        new Date(context.clock.now().getTime() - FIFTEEN_MINUTES_MS)
      )
    ).toBe(0);
  });

  it("newPassword === currentPassword → SamePasswordError", async () => {
    const userId = await createUser(context);

    await expect(
      context.profileService.changePassword(userId, {
        currentPassword: STRONG_PASSWORD,
        newPassword: STRONG_PASSWORD,
        confirmPassword: STRONG_PASSWORD,
      })
    ).rejects.toBeInstanceOf(SamePasswordError);
  });

  it("confirmPassword !== newPassword → PasswordsDoNotMatchError", async () => {
    const userId = await createUser(context);

    await expect(
      context.profileService.changePassword(userId, {
        currentPassword: STRONG_PASSWORD,
        newPassword: OTHER_PASSWORD,
        confirmPassword: "different-pass1!",
      })
    ).rejects.toBeInstanceOf(PasswordsDoNotMatchError);
  });

  it("5 failures in 15 minutes → the 6th attempt is RateLimitExceededError even with correct credentials", async () => {
    const userId = await createUser(context);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        context.profileService.changePassword(userId, {
          currentPassword: "wrong-pass1!",
          newPassword: OTHER_PASSWORD,
          confirmPassword: OTHER_PASSWORD,
        })
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
      context.clock.advanceBy(1000);
    }

    await expect(
      context.profileService.changePassword(userId, {
        currentPassword: STRONG_PASSWORD,
        newPassword: OTHER_PASSWORD,
        confirmPassword: OTHER_PASSWORD,
      })
    ).rejects.toBeInstanceOf(RateLimitExceededError);
  });

  it("a failure 16 minutes old does not count toward the rate limit", async () => {
    const userId = await createUser(context);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        context.profileService.changePassword(userId, {
          currentPassword: "wrong-pass1!",
          newPassword: OTHER_PASSWORD,
          confirmPassword: OTHER_PASSWORD,
        })
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    }
    context.clock.advanceBy(16 * 60_000);

    // All 5 failures are now outside the window, so a correct change succeeds instead of rate-limiting.
    await expect(
      context.profileService.changePassword(userId, {
        currentPassword: STRONG_PASSWORD,
        newPassword: OTHER_PASSWORD,
        confirmPassword: OTHER_PASSWORD,
      })
    ).resolves.toBeUndefined();
  });

  it("a successful change updates passwordHash, revokes all refresh tokens, and records no failure", async () => {
    const userId = await createUser(context);
    const activeToken = {
      id: randomUUID(),
      userId,
      tokenHash: "hash-1",
      expiresAt: new Date(context.clock.now().getTime() + 60_000),
      createdAt: context.clock.now(),
    };
    context.authPersistence.refreshTokens.createRefreshToken(activeToken);

    await expect(
      context.profileService.changePassword(userId, {
        currentPassword: STRONG_PASSWORD,
        newPassword: OTHER_PASSWORD,
        confirmPassword: OTHER_PASSWORD,
      })
    ).resolves.toBeUndefined();

    const user = context.authPersistence.users.findById(userId);
    expect(user).not.toBeNull();
    await expect(context.passwordHasher.verify(user!.passwordHash!, OTHER_PASSWORD)).resolves.toBe(true);
    expect(context.authPersistence.refreshTokens.findByHash("hash-1")?.revokedAt).toEqual(context.clock.now());
    expect(
      context.profilePersistence.passwordChangeAttempts.countFailuresSince(
        userId,
        new Date(context.clock.now().getTime() - FIFTEEN_MINUTES_MS)
      )
    ).toBe(0);
  });
});

describe("ProfileService.exportProfileData (T-UA-06)", () => {
  it("payload contains exactly the D-01 field list, no transactions/budgets/goals keys", async () => {
    const userId = await createUser(context);

    const payload = await context.profileService.exportProfileData(userId);

    expect(Object.keys(payload).sort()).toEqual(
      [
        "avatarUrl",
        "createdAt",
        "email",
        "id",
        "language",
        "monthlyStartDate",
        "name",
        "notificationPreferences",
        "preferredCurrency",
        "updatedAt",
      ].sort()
    );
    expect(payload).not.toHaveProperty("transactions");
    expect(payload).not.toHaveProperty("budgets");
    expect(payload).not.toHaveProperty("goals");
  });

  it("lazily creates the profile if absent", async () => {
    const userId = await createUser(context);
    expect(context.profilePersistence.profiles.findByUserId(userId)).toBeNull();

    await context.profileService.exportProfileData(userId);

    expect(context.profilePersistence.profiles.findByUserId(userId)).not.toBeNull();
  });
});

describe("ProfileService.clearAllUserData (T-UA-07)", () => {
  it("resets user_profiles to baseline defaults", async () => {
    const userId = await createUser(context);
    await context.profileService.updateProfile(userId, {
      avatarUrl: "https://example.com/z.png",
      notificationPreferences: { budgetLimitAlerts: false, goalReminders: false, weeklySummaryEmails: false },
    });

    await context.profileService.clearAllUserData(userId);

    const profile = context.profilePersistence.profiles.findByUserId(userId);
    expect(profile).toMatchObject({
      avatarUrl: null,
      preferredCurrency: "NPR",
      language: "en_US",
      monthlyStartDate: 1,
      notificationBudgetLimitAlerts: true,
      notificationGoalReminders: true,
      notificationWeeklySummaryEmails: true,
    });
  });

  it("does not modify users.name/.email/.passwordHash", async () => {
    const userId = await createUser(context, { name: "Keep Me", email: "keep@example.com" });
    const before = context.authPersistence.users.findById(userId);

    await context.profileService.clearAllUserData(userId);

    const after = context.authPersistence.users.findById(userId);
    expect(after?.name).toBe(before?.name);
    expect(after?.email).toBe(before?.email);
    expect(after?.passwordHash).toBe(before?.passwordHash);
  });

  it("clearAllUserData itself has no confirmation parameter — rejecting a bad confirmation is the router's job (contract §5.5)", async () => {
    // ProfileService.clearAllUserData takes only a userId; the `confirmation` literal check is
    // enforced by the Zod `ClearDataConfirmation` rule set at the contract boundary (T-UA-08) and
    // exercised end-to-end at the route level (T-UA-09). Documented here so the boundary is explicit.
    const userId = await createUser(context);
    await expect(context.profileService.clearAllUserData(userId)).resolves.toBeUndefined();
  });
});
