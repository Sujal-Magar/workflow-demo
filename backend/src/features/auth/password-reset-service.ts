import type { ForgotPasswordAck } from "@workflow-demo/contracts";
import { randomUUID } from "node:crypto";

import type { Clock } from "../../shared/clock";
import {
  FORGOT_PASSWORD_ACK_MESSAGE,
  MILLISECONDS_PER_MINUTE,
  RESET_PASSWORD_PAGE_PATH,
  RESET_TOKEN_LIFETIME_MINUTES,
} from "./auth-constants";
import { InvalidResetTokenError } from "./auth-errors";
import type { AuthPersistence } from "./auth-persistence";
import { normalizeEmail } from "./normalize-email";
import type { PasswordResetTokenRecord } from "./password-reset-token-repository";
import type { Mailer } from "./ports/mailer";
import type { PasswordHasher } from "./ports/password-hasher";
import type { TokenGenerator } from "./ports/token-generator";

export interface ResetPasswordInput {
  readonly token: string;
  readonly password: string;
}

export interface PasswordResetServiceDependencies {
  readonly persistence: AuthPersistence;
  readonly passwordHasher: PasswordHasher;
  readonly tokenGenerator: TokenGenerator;
  readonly mailer: Mailer;
  readonly clock: Clock;
  readonly frontendOrigin: string;
}

const FORGOT_PASSWORD_ACK: ForgotPasswordAck = { success: true, message: FORGOT_PASSWORD_ACK_MESSAGE };

function isResetTokenUsable(token: PasswordResetTokenRecord, now: Date): boolean {
  return token.usedAt === null && token.expiresAt.getTime() > now.getTime();
}

/** Two-step password recovery (REQ-AUTH-05): request a reset link, then set a new password with it. */
export class PasswordResetService {
  constructor(private readonly dependencies: PasswordResetServiceDependencies) {}

  /** Always returns the identical acknowledgement, whether or not the account exists. */
  async requestPasswordReset(emailInput: string): Promise<ForgotPasswordAck> {
    const { persistence, tokenGenerator, mailer, clock } = this.dependencies;
    const email = normalizeEmail(emailInput);
    const user = persistence.users.findByEmail(email);
    if (user === null) {
      return FORGOT_PASSWORD_ACK;
    }
    const rawToken = tokenGenerator.generate();
    const now = clock.now();
    persistence.runInTransaction((repositories) => {
      // At most one valid reset link per user: earlier unused tokens are superseded.
      repositories.passwordResetTokens.invalidateUnusedForUser(user.id, now);
      repositories.passwordResetTokens.createResetToken({
        id: randomUUID(),
        userId: user.id,
        tokenHash: tokenGenerator.hash(rawToken),
        expiresAt: new Date(now.getTime() + RESET_TOKEN_LIFETIME_MINUTES * MILLISECONDS_PER_MINUTE),
        createdAt: now,
      });
    });
    await mailer.sendPasswordResetLink({ email: user.email, resetUrl: this.buildResetUrl(rawToken) });
    return FORGOT_PASSWORD_ACK;
  }

  /** Sets the new password, consumes the token and ends every session. Does not sign the user in. */
  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const { persistence, passwordHasher, tokenGenerator, clock } = this.dependencies;
    const storedToken = persistence.passwordResetTokens.findByHash(tokenGenerator.hash(input.token));
    if (storedToken === null || !isResetTokenUsable(storedToken, clock.now())) {
      throw new InvalidResetTokenError();
    }
    // Hash before the (synchronous) transaction opens.
    const passwordHash = await passwordHasher.hash(input.password);
    const now = clock.now();
    persistence.runInTransaction((repositories) => {
      // The lookup above is only a fast path: a concurrent reset may have passed it while this one
      // was hashing. The conditional mark-used runs first and decides the winner.
      if (!repositories.passwordResetTokens.markUsedIfUnused(storedToken.id, now)) {
        throw new InvalidResetTokenError();
      }
      repositories.users.updatePasswordHash(storedToken.userId, passwordHash, now);
      repositories.refreshTokens.revokeAllForUser(storedToken.userId, now);
    });
  }

  private buildResetUrl(rawToken: string): string {
    const resetUrl = new URL(RESET_PASSWORD_PAGE_PATH, this.dependencies.frontendOrigin);
    resetUrl.searchParams.set("token", rawToken);
    return resetUrl.toString();
  }
}
