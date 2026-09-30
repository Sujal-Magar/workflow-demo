import { SignJWT, jwtVerify } from "jose";

import type { Clock } from "../../../shared/clock";
import { ACCESS_TOKEN_LIFETIME_SECONDS, MILLISECONDS_PER_SECOND } from "../auth-constants";

const ALGORITHM = "HS256";

export interface AccessTokenSigner {
  /** Signs an access token whose `sub` is the user id and which expires 900 s after issue. */
  sign(userId: string): Promise<string>;
  /** Returns the token's user id, or `null` when the token is invalid, expired or wrongly signed. */
  verify(token: string): Promise<string | null>;
}

/** HS256 JWTs via jose. HS256 is the only accepted algorithm. */
export class JoseAccessTokenSigner implements AccessTokenSigner {
  private readonly key: Uint8Array;

  constructor(
    secret: string,
    private readonly clock: Clock
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  sign(userId: string): Promise<string> {
    const issuedAt = Math.floor(this.clock.now().getTime() / MILLISECONDS_PER_SECOND);
    return new SignJWT({})
      .setProtectedHeader({ alg: ALGORITHM })
      .setSubject(userId)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + ACCESS_TOKEN_LIFETIME_SECONDS)
      .sign(this.key);
  }

  async verify(token: string): Promise<string | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: [ALGORITHM],
        requiredClaims: ["sub", "exp"],
        currentDate: this.clock.now(),
      });
      return typeof payload.sub === "string" && payload.sub !== "" ? payload.sub : null;
    } catch {
      // jose throws for every invalid token (signature, algorithm, expiry, malformed); all mean "not authenticated".
      return null;
    }
  }
}
