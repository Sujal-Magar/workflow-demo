import { OAuth2Client } from "google-auth-library";

export interface GoogleIdentity {
  /** Google `sub` claim. */
  readonly googleId: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly name: string | null;
}

export interface GoogleTokenVerifier {
  /** Returns the verified identity, or `null` when the ID token is invalid for any reason. */
  verify(idToken: string): Promise<GoogleIdentity | null>;
}

interface GoogleIdTokenClaims {
  readonly sub?: string;
  readonly email?: string;
  readonly email_verified?: boolean;
  readonly name?: string;
}

/** The part of google-auth-library's `OAuth2Client` this adapter uses, so tests can stub it. */
export interface IdTokenVerificationClient {
  verifyIdToken(options: {
    idToken: string;
    audience: string;
  }): Promise<{ getPayload(): GoogleIdTokenClaims | undefined }>;
}

/**
 * Verifies Google ID tokens (signature, expiry, audience = `GOOGLE_CLIENT_ID`). Without a
 * configured client ID it reports every token as invalid and never calls Google.
 */
export class GoogleAuthLibraryTokenVerifier implements GoogleTokenVerifier {
  constructor(
    private readonly clientId: string | null,
    private readonly client: IdTokenVerificationClient = new OAuth2Client()
  ) {}

  async verify(idToken: string): Promise<GoogleIdentity | null> {
    if (this.clientId === null) {
      return null;
    }
    const claims = await this.readVerifiedClaims(idToken, this.clientId);
    if (!claims?.sub || !claims.email || claims.email_verified !== true) {
      return null;
    }
    return {
      googleId: claims.sub,
      email: claims.email,
      emailVerified: true,
      name: claims.name ?? null,
    };
  }

  private async readVerifiedClaims(idToken: string, audience: string): Promise<GoogleIdTokenClaims | undefined> {
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience });
      return ticket.getPayload();
    } catch {
      // Any verification failure (signature, expiry, audience, malformed token) means "invalid".
      return undefined;
    }
  }
}
