import type { UserProfile } from "@workflow-demo/contracts";
import { randomUUID } from "node:crypto";

import type { Clock } from "../../shared/clock";
import { InvalidCredentialsError, UnauthenticatedError } from "../auth/auth-errors";
import type { AuthPersistence } from "../auth/auth-persistence";
import type { PasswordHasher } from "../auth/ports/password-hasher";
import type { UserRecord } from "../auth/user-repository";
import {
  MILLISECONDS_PER_MINUTE,
  PASSWORD_CHANGE_RATE_LIMIT_THRESHOLD,
  PASSWORD_CHANGE_RATE_LIMIT_WINDOW_MINUTES,
} from "./profile-constants";
import {
  PasswordNotSetError,
  PasswordsDoNotMatchError,
  RateLimitExceededError,
  SamePasswordError,
} from "./profile-errors";
import type { ProfilePatch, ProfileRecord } from "./profile-repository";
import type { ProfilePersistence } from "./profile-persistence";

export interface UpdateProfileInput {
  readonly name?: string;
  readonly avatarUrl?: string;
  readonly notificationPreferences?: {
    readonly budgetLimitAlerts?: boolean;
    readonly goalReminders?: boolean;
    readonly weeklySummaryEmails?: boolean;
  };
}

export interface ChangePasswordInput {
  readonly currentPassword: string;
  readonly newPassword: string;
  readonly confirmPassword: string;
}

export interface ProfileServiceDependencies {
  readonly profilePersistence: ProfilePersistence;
  readonly authPersistence: AuthPersistence;
  readonly passwordHasher: PasswordHasher;
  readonly clock: Clock;
}

function assembleUserProfile(profile: ProfileRecord, user: UserRecord): UserProfile {
  return {
    // `id` equals the account's user id, not a separate `user_profiles` surrogate key (D-04).
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: profile.avatarUrl,
    preferredCurrency: profile.preferredCurrency,
    language: profile.language,
    monthlyStartDate: profile.monthlyStartDate,
    notificationPreferences: {
      budgetLimitAlerts: profile.notificationBudgetLimitAlerts,
      goalReminders: profile.notificationGoalReminders,
      weeklySummaryEmails: profile.notificationWeeklySummaryEmails,
    },
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

/** Business rules for the profile page: read/edit profile, change password, export and clear data. */
export class ProfileService {
  constructor(private readonly dependencies: ProfileServiceDependencies) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const profile = this.getOrCreateProfile(userId);
    const user = this.findUserOrThrow(userId);
    return assembleUserProfile(profile, user);
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile> {
    const { profilePersistence, authPersistence, clock } = this.dependencies;
    this.getOrCreateProfile(userId);
    const now = clock.now();

    if (input.name !== undefined) {
      authPersistence.users.updateName(userId, input.name, now);
    }

    const patch: { -readonly [K in keyof ProfilePatch]: ProfilePatch[K] } = {};
    if (input.avatarUrl !== undefined) {
      patch.avatarUrl = input.avatarUrl;
    }
    if (input.notificationPreferences?.budgetLimitAlerts !== undefined) {
      patch.notificationBudgetLimitAlerts = input.notificationPreferences.budgetLimitAlerts;
    }
    if (input.notificationPreferences?.goalReminders !== undefined) {
      patch.notificationGoalReminders = input.notificationPreferences.goalReminders;
    }
    if (input.notificationPreferences?.weeklySummaryEmails !== undefined) {
      patch.notificationWeeklySummaryEmails = input.notificationPreferences.weeklySummaryEmails;
    }
    if (Object.keys(patch).length > 0) {
      profilePersistence.profiles.update(userId, patch, now);
    }

    return this.getProfile(userId);
  }

  /** Contract §5.3's five-step order, authoritative and in this exact sequence. */
  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const { profilePersistence, authPersistence, passwordHasher, clock } = this.dependencies;
    const now = clock.now();
    const windowStart = new Date(now.getTime() - PASSWORD_CHANGE_RATE_LIMIT_WINDOW_MINUTES * MILLISECONDS_PER_MINUTE);

    const recentFailures = profilePersistence.passwordChangeAttempts.countFailuresSince(userId, windowStart);
    if (recentFailures >= PASSWORD_CHANGE_RATE_LIMIT_THRESHOLD) {
      throw new RateLimitExceededError();
    }

    const user = this.findUserOrThrow(userId);
    if (user.passwordHash === null) {
      throw new PasswordNotSetError();
    }

    const isCurrentPasswordValid = await passwordHasher.verify(user.passwordHash, input.currentPassword);
    if (!isCurrentPasswordValid) {
      profilePersistence.passwordChangeAttempts.recordFailure(randomUUID(), userId, now);
      throw new InvalidCredentialsError();
    }

    if (input.newPassword === input.currentPassword) {
      throw new SamePasswordError();
    }
    if (input.confirmPassword !== input.newPassword) {
      throw new PasswordsDoNotMatchError();
    }

    const newPasswordHash = await passwordHasher.hash(input.newPassword);
    authPersistence.runInTransaction((repositories) => {
      repositories.users.updatePasswordHash(userId, newPasswordHash, now);
      repositories.refreshTokens.revokeAllForUser(userId, now);
    });
  }

  /** Payload contains exactly the D-01-scoped `UserProfile` field set — a narrow return type, not a generic blob. */
  async exportProfileData(userId: string): Promise<UserProfile> {
    return this.getProfile(userId);
  }

  async clearAllUserData(userId: string): Promise<void> {
    this.getOrCreateProfile(userId);
    this.dependencies.profilePersistence.profiles.resetToDefaults(userId, this.dependencies.clock.now());
  }

  /** Looks up by `userId`; inserts baseline defaults on first access (D-11). */
  private getOrCreateProfile(userId: string): ProfileRecord {
    const { profilePersistence, clock } = this.dependencies;
    const existing = profilePersistence.profiles.findByUserId(userId);
    if (existing !== null) {
      return existing;
    }
    return profilePersistence.profiles.create({ id: randomUUID(), userId, createdAt: clock.now() });
  }

  private findUserOrThrow(userId: string): UserRecord {
    const user = this.dependencies.authPersistence.users.findById(userId);
    if (user === null) {
      throw new UnauthenticatedError("The account no longer exists.");
    }
    return user;
  }
}
