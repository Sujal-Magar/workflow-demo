// In-memory access token store (plan FE-10, D-23). Never written to Web Storage, cookies or IndexedDB.
// Lives in `lib/` so the API fetcher can attach the Bearer without importing the session layer. Imports nothing.

const MILLISECONDS_PER_SECOND = 1000;

let accessToken: string | null = null;
let expiresAtMs: number | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

/** Epoch milliseconds at which the stored token expires, or `null` when no token is stored. */
export function getAccessTokenExpiresAt(): number | null {
  return expiresAtMs;
}

export function setAccessToken(token: string, expiresInSeconds: number): void {
  accessToken = token;
  expiresAtMs = Date.now() + expiresInSeconds * MILLISECONDS_PER_SECOND;
}

export function clearAccessToken(): void {
  accessToken = null;
  expiresAtMs = null;
}
