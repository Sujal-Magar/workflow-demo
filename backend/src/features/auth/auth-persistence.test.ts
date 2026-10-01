import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  STRONG_PASSWORD,
  OTHER_STRONG_PASSWORD,
  createAuthTestContext,
  type AuthTestContext,
} from "../../test-support/auth-test-harness";
import { RefreshTokenRepository } from "./refresh-token-repository";

let context: AuthTestContext;

beforeEach(() => {
  context = createAuthTestContext();
});

afterEach(() => {
  vi.restoreAllMocks();
  context.close();
});

describe("AuthPersistence unit of work (T-UA-03)", () => {
  it("commits the callback's writes and returns its value", async () => {
    const { user } = await context.authService.register({ name: "A B", email: "a@b.co", password: STRONG_PASSWORD });

    const result = context.persistence.runInTransaction((repositories) => {
      repositories.users.updatePasswordHash(user.id, "$argon2id$committed", context.clock.now());
      return "done";
    });

    expect(result).toBe("done");
    expect(context.persistence.users.findById(user.id)?.passwordHash).toBe("$argon2id$committed");
  });

  it("rolls back every write when the callback throws", async () => {
    const { user } = await context.authService.register({ name: "A B", email: "a@b.co", password: STRONG_PASSWORD });
    const originalHash = context.persistence.users.findById(user.id)?.passwordHash;

    expect(() =>
      context.persistence.runInTransaction((repositories) => {
        repositories.users.updatePasswordHash(user.id, "$argon2id$rolled-back", context.clock.now());
        throw new Error("boom");
      })
    ).toThrow("boom");

    expect(context.persistence.users.findById(user.id)?.passwordHash).toBe(originalHash);
  });

  it("a failure midway through reset-password rolls back the hash, the token and the refresh tokens", async () => {
    const { user, refreshToken } = await context.authService.register({
      name: "A B",
      email: "a@b.co",
      password: STRONG_PASSWORD,
    });
    await context.passwordResetService.requestPasswordReset("a@b.co");
    const resetToken = context.mailer.lastToken();
    const originalHash = context.persistence.users.findById(user.id)?.passwordHash;
    vi.spyOn(RefreshTokenRepository.prototype, "revokeAllForUser").mockImplementation(() => {
      throw new Error("simulated failure after the hash update");
    });

    await expect(
      context.passwordResetService.resetPassword({ token: resetToken, password: OTHER_STRONG_PASSWORD })
    ).rejects.toThrow("simulated failure after the hash update");

    const { persistence, tokenGenerator } = context;
    expect(persistence.users.findById(user.id)?.passwordHash).toBe(originalHash);
    expect(persistence.passwordResetTokens.findByHash(tokenGenerator.hash(resetToken))?.usedAt).toBeNull();
    expect(persistence.refreshTokens.findByHash(tokenGenerator.hash(refreshToken))?.revokedAt).toBeNull();
  });
});
