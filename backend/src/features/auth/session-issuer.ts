import { randomUUID } from "node:crypto";

import type { Clock } from "../../shared/clock";
import {
  ACCESS_TOKEN_LIFETIME_SECONDS,
  MILLISECONDS_PER_SECOND,
  REFRESH_TOKEN_LIFETIME_SECONDS,
} from "./auth-constants";
import type { AccessTokenSigner } from "./ports/access-token-signer";
import type { TokenGenerator } from "./ports/token-generator";
import type { RefreshTokenRepository } from "./refresh-token-repository";

export interface SignedAccessToken {
  readonly accessToken: string;
  /** Seconds until the access token expires (always 900 in v1.0.0). */
  readonly expiresIn: number;
}

export interface IssuedSession extends SignedAccessToken {
  /** Raw refresh token. Presentation puts it in the cookie only, never in a response body. */
  readonly refreshToken: string;
}

export interface SessionIssuerDependencies {
  readonly accessTokenSigner: AccessTokenSigner;
  readonly tokenGenerator: TokenGenerator;
  readonly clock: Clock;
}

export class SessionIssuer {
  constructor(private readonly dependencies: SessionIssuerDependencies) {}

  /** Signs an access token and stores a new refresh token (hash only) for the user. */
  async issueSession(userId: string, refreshTokens: RefreshTokenRepository): Promise<IssuedSession> {
    const signed = await this.signAccessToken(userId);
    const refreshToken = this.storeNewRefreshToken(userId, refreshTokens);
    return { ...signed, refreshToken };
  }

  async signAccessToken(userId: string): Promise<SignedAccessToken> {
    const accessToken = await this.dependencies.accessTokenSigner.sign(userId);
    return { accessToken, expiresIn: ACCESS_TOKEN_LIFETIME_SECONDS };
  }

  /**
   * Generates a raw refresh token, stores its SHA-256 hash expiring in 7 days, and returns the raw
   * value. Synchronous, so it can run inside a transaction.
   */
  storeNewRefreshToken(userId: string, refreshTokens: RefreshTokenRepository): string {
    const { tokenGenerator, clock } = this.dependencies;
    const rawToken = tokenGenerator.generate();
    const now = clock.now();
    refreshTokens.createRefreshToken({
      id: randomUUID(),
      userId,
      tokenHash: tokenGenerator.hash(rawToken),
      expiresAt: new Date(now.getTime() + REFRESH_TOKEN_LIFETIME_SECONDS * MILLISECONDS_PER_SECOND),
      createdAt: now,
    });
    return rawToken;
  }
}
