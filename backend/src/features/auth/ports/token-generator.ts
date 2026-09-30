import { createHash, randomBytes } from "node:crypto";

import { OPAQUE_TOKEN_BYTES } from "../auth-constants";

export interface TokenGenerator {
  /** A new opaque token: 32 random bytes, base64url encoded (43 characters). */
  generate(): string;
  /** SHA-256 hex digest of a raw token; only this value is ever stored. */
  hash(rawToken: string): string;
}

export class CryptoTokenGenerator implements TokenGenerator {
  generate(): string {
    return randomBytes(OPAQUE_TOKEN_BYTES).toString("base64url");
  }

  hash(rawToken: string): string {
    return createHash("sha256").update(rawToken).digest("hex");
  }
}
