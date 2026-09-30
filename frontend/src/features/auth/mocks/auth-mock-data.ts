// Phase 5 mock fixtures (plan FE-05). Deleted in INT-05.
import type { PublicUser } from "./auth-types.mock";

export const MOCK_LATENCY_MS = 400;
export const MOCK_ACCESS_TOKEN_LIFETIME_SECONDS = 900;
export const MOCK_VALID_RESET_TOKEN = "valid-token";
export const MOCK_BAD_GOOGLE_CREDENTIAL = "bad-credential";
/** Any email containing this marker simulates a network failure. */
export const MOCK_NETWORK_FAILURE_MARKER = "fail@";
export const MOCK_FORGOT_PASSWORD_MESSAGE = "If an account exists for that email, a reset link has been sent.";

export interface MockAccount {
  readonly user: PublicUser;
  /** `null` for a Google-only account that has never set a password. */
  password: string | null;
}

export function createSeedAccounts(): MockAccount[] {
  return [
    {
      user: { id: "3f1c2a52-8a4e-4c1e-9b1f-6d7f0e9a1b01", name: "Piyush Kumar", email: "piyush@example.com" },
      password: "Passw0rd!",
    },
    {
      user: { id: "7b2d9c14-5e6f-4a3b-8c9d-0e1f2a3b4c02", name: "Gia Rossi", email: "gia@example.com" },
      password: null,
    },
    {
      user: { id: "9a8b7c6d-5e4f-4a2b-9c1d-0e2f3a4b5c03", name: "Taken User", email: "taken@example.com" },
      password: "Taken123!",
    },
  ];
}
