// Phase 5 mock fixtures (plan FE-09). Deleted in INT-02/INT-03.
import type { UserProfile } from "./profile-types.mock";

export const MOCK_LATENCY_MS = 400;
export const MOCK_SEED_PASSWORD = "Passw0rd!";
/** Simulates a Google SSO account with no password set (D-10). */
export const MOCK_NO_PASSWORD_MARKER = "google-sso-no-password";
export const MOCK_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const MOCK_RATE_LIMIT_THRESHOLD = 5;

export const PASSWORD_UPDATED_MESSAGE = "Password updated successfully.";
export const DATA_CLEARED_MESSAGE = "All profile data has been cleared.";

export function createSeedProfile(): UserProfile {
  const now = new Date().toISOString();
  return {
    id: "3f1c2a52-8a4e-4c1e-9b1f-6d7f0e9a1b01",
    name: "Piyush Kumar",
    email: "piyush@example.com",
    avatarUrl: null,
    preferredCurrency: "NPR",
    language: "en_US",
    monthlyStartDate: 1,
    notificationPreferences: {
      budgetLimitAlerts: true,
      goalReminders: true,
      weeklySummaryEmails: true,
    },
    createdAt: now,
    updatedAt: now,
  };
}
