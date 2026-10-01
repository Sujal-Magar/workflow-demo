import type { PublicUser } from "@workflow-demo/contracts";
import { randomUUID } from "node:crypto";

import type { Clock } from "../../shared/clock";
import {
  EmailAlreadyExistsError,
  InvalidCredentialsError,
  InvalidGoogleTokenError,
  UnauthenticatedError,
} from "./auth-errors";
import type { AuthPersistence } from "./auth-persistence";
import { normalizeEmail } from "./normalize-email";
import type { GoogleTokenVerifier } from "./ports/google-token-verifier";
import type { PasswordHasher } from "./ports/password-hasher";
import type { TokenGenerator } from "./ports/token-generator";
import type { RefreshTokenRecord } from "./refresh-token-repository";
import { resolveGoogleName } from "./resolve-google-name";
import type { IssuedSession, SessionIssuer } from "./session-issuer";
import { toPublicUser } from "./user-mapper";
import type { UserRecord } from "./user-repository";

// Hashed once, lazily, with the configured cost, so a login for an unknown or password-less
// account spends the same argon2 verification time as a real one (plan D-16).
const TIMING_GUARD_PASSWORD = "timing-guard-password-never-matches";

export interface AuthenticatedSession extends IssuedSession {
  readonly user: PublicUser;
}

export interface RegisterInput {
  readonly name: string;
  readonly email: string;
  readonly password: string;
}

export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

interface VerifiedGoogleAccount {
  readonly googleId: string;
  readonly email: string;
  readonly name: string | null;
}

export interface AuthServiceDependencies {
  readonly persistence: AuthPersistence;
  readonly passwordHasher: PasswordHasher;
  readonly googleTokenVerifier: GoogleTokenVerifier;
  readonly sessionIssuer: SessionIssuer;
  readonly tokenGenerator: TokenGenerator;
  readonly clock: Clock;
}

function isRefreshTokenActive(token: RefreshTokenRecord, now: Date): boolean {
  return token.revokedAt === null && token.expiresAt.getTime() > now.getTime();
}

/** Account and session business rules: register, login, Google sign-in, refresh, current user, logout. */
export class AuthService {
  private timingGuardHash: Promise<string> | null = null;

  constructor(private readonly dependencies: AuthServiceDependencies) {}

  async register(input: RegisterInput): Promise<AuthenticatedSession> {
    const { persistence, passwordHasher, clock } = this.dependencies;
    const email = normalizeEmail(input.email);
    if (persistence.users.findByEmail(email) !== null) {
      throw new EmailAlreadyExistsError();
    }
    const passwordHash = await passwordHasher.hash(input.password);
    const created = persistence.users.createUser({
      id: randomUUID(),
      name: input.name,
      email,
      passwordHash,
      provider: "email",
      googleId: null,
      createdAt: clock.now(),
    });
    // The email can be taken while the password is hashing (a concurrent sign-up won the race).
    if (created.status === "email-taken") {
      throw new EmailAlreadyExistsError();
    }
    return this.startSession(created.user);
  }

  async login(input: LoginInput): Promise<AuthenticatedSession> {
    const { persistence, passwordHasher } = this.dependencies;
    const user = persistence.users.findByEmail(normalizeEmail(input.email));

    if (user?.passwordHash == null) {
      await passwordHasher.verify(await this.getTimingGuardHash(), input.password);
      throw new InvalidCredentialsError();
    }

    const isPasswordValid = await passwordHasher.verify(user.passwordHash, input.password);
    if (!isPasswordValid) {
      throw new InvalidCredentialsError();
    }
    return this.startSession(user);
  }

  async signInWithGoogle(idToken: string): Promise<AuthenticatedSession> {
    const identity = await this.dependencies.googleTokenVerifier.verify(idToken);
    if (identity === null) {
      throw new InvalidGoogleTokenError("the ID token failed verification");
    }
    if (!identity.emailVerified) {
      throw new InvalidGoogleTokenError("the Google email is not verified");
    }
    const user = this.resolveGoogleAccount({
      googleId: identity.googleId,
      email: normalizeEmail(identity.email),
      name: identity.name,
    });
    return this.startSession(user);
  }

  async refreshSession(rawRefreshToken: string | undefined): Promise<AuthenticatedSession> {
    if (!rawRefreshToken) {
      throw new UnauthenticatedError("No refresh token was presented.");
    }
    const { persistence, tokenGenerator, sessionIssuer, clock } = this.dependencies;
    const storedToken = persistence.refreshTokens.findByHash(tokenGenerator.hash(rawRefreshToken));
    if (storedToken === null || !isRefreshTokenActive(storedToken, clock.now())) {
      throw new UnauthenticatedError("The refresh token is unknown, revoked or expired.");
    }
    const user = persistence.users.findById(storedToken.userId);
    if (user === null) {
      throw new UnauthenticatedError("The refresh token's account no longer exists.");
    }
    const signed = await sessionIssuer.signAccessToken(user.id);
    // The lookup above is only a fast path: another refresh with the same token may have passed it
    // while this one was signing. The conditional revoke decides the winner inside the transaction.
    const refreshToken = persistence.runInTransaction((repositories) => {
      if (!repositories.refreshTokens.revokeIfActive(storedToken.id, clock.now())) {
        throw new UnauthenticatedError("The refresh token was already rotated.");
      }
      return sessionIssuer.storeNewRefreshToken(user.id, repositories.refreshTokens);
    });
    return { user: toPublicUser(user), ...signed, refreshToken };
  }

  async getCurrentUser(userId: string): Promise<PublicUser> {
    const user = this.dependencies.persistence.users.findById(userId);
    if (user === null) {
      throw new UnauthenticatedError("The account no longer exists.");
    }
    return toPublicUser(user);
  }

  /** Revokes the presented refresh token when it is known and active; every other case succeeds silently. */
  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }
    const { persistence, tokenGenerator, clock } = this.dependencies;
    const storedToken = persistence.refreshTokens.findByHash(tokenGenerator.hash(rawRefreshToken));
    if (storedToken !== null) {
      persistence.refreshTokens.revokeIfActive(storedToken.id, clock.now());
    }
  }

  private async startSession(user: UserRecord): Promise<AuthenticatedSession> {
    const { sessionIssuer, persistence } = this.dependencies;
    const session = await sessionIssuer.issueSession(user.id, persistence.refreshTokens);
    return { user: toPublicUser(user), ...session };
  }

  private getTimingGuardHash(): Promise<string> {
    this.timingGuardHash ??= this.dependencies.passwordHasher.hash(TIMING_GUARD_PASSWORD);
    return this.timingGuardHash;
  }

  /** REQ-AUTH-03 resolution order: Google ID, then link by email, then create. */
  private resolveGoogleAccount(account: VerifiedGoogleAccount): UserRecord {
    const linkedUser = this.dependencies.persistence.users.findByGoogleId(account.googleId);
    if (linkedUser !== null) {
      return linkedUser;
    }
    const resolvedUser = this.linkOrCreateGoogleAccount(account);
    if (resolvedUser !== null) {
      return resolvedUser;
    }
    // D-14: a concurrent sign-up took this email between the lookup and the insert.
    // Re-run once from the link step, which now finds and links that account.
    const retriedUser = this.linkOrCreateGoogleAccount(account);
    if (retriedUser !== null) {
      return retriedUser;
    }
    throw new Error("Google account resolution failed: the email was still taken after one retry.");
  }

  /** Returns `null` only when creating the account hit the email UNIQUE constraint. */
  private linkOrCreateGoogleAccount(account: VerifiedGoogleAccount): UserRecord | null {
    const { users } = this.dependencies.persistence;
    const emailUser = users.findByEmail(account.email);
    if (emailUser !== null) {
      return this.linkGoogleId(emailUser, account.googleId);
    }
    const created = users.createUser({
      id: randomUUID(),
      name: resolveGoogleName(account.name, account.email),
      email: account.email,
      passwordHash: null,
      provider: "google",
      googleId: account.googleId,
      createdAt: this.dependencies.clock.now(),
    });
    return created.status === "created" ? created.user : null;
  }

  /** Links the Google ID, keeping provider and password. A different existing Google ID is never overwritten. */
  private linkGoogleId(user: UserRecord, googleId: string): UserRecord {
    if (user.googleId === googleId) {
      return user;
    }
    if (user.googleId !== null) {
      throw new InvalidGoogleTokenError("the email's account is linked to a different Google identity");
    }
    const updatedAt = this.dependencies.clock.now();
    this.dependencies.persistence.users.linkGoogleId(user.id, googleId, updatedAt);
    return { ...user, googleId, updatedAt };
  }
}
