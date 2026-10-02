// Phase 5 stand-in for the shape schemas and types of `@workflow-demo/contracts` (contract.md §2, §3).
// Deleted in INT-02/INT-03, when every import switches to the real contract package.
import { z } from "zod";

/** contract.md §3 Error Code Catalog (profile-specific additions + the shared codes profile reuses). */
export const PROFILE_ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  NOT_FOUND: "NOT_FOUND",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  PASSWORD_NOT_SET: "PASSWORD_NOT_SET",
  SAME_PASSWORD: "SAME_PASSWORD",
  PASSWORDS_DO_NOT_MATCH: "PASSWORDS_DO_NOT_MATCH",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
} as const;

export type ProfileErrorCode = (typeof PROFILE_ERROR_CODES)[keyof typeof PROFILE_ERROR_CODES];

const errorCodeValues = Object.values(PROFILE_ERROR_CODES) as [ProfileErrorCode, ...ProfileErrorCode[]];

/** §2.2 */
export const notificationPreferencesSchema = z.object({
  budgetLimitAlerts: z.boolean(),
  goalReminders: z.boolean(),
  weeklySummaryEmails: z.boolean(),
});

/** §2.1 */
export const userProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  preferredCurrency: z.enum(["NPR", "USD", "EUR", "GBP"]),
  language: z.enum(["en_US", "en_GB", "es", "fr"]),
  monthlyStartDate: z.number().int(),
  notificationPreferences: notificationPreferencesSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** §2.5 */
export const profileSuccessAckSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

/** §2.5 (error body), mirroring `features/auth/plans/v1.0.0/contract.md` §2.5. */
export const errorBodySchema = z.object({
  code: z.enum(errorCodeValues),
  message: z.string(),
  fieldErrors: z.record(z.string(), z.string()).optional(),
});

export type UserProfile = z.infer<typeof userProfileSchema>;
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
export type ProfileSuccessAck = z.infer<typeof profileSuccessAckSchema>;
export type ErrorBody = z.infer<typeof errorBodySchema>;

/** §2.3 — every field optional; absence means "unchanged" (D-06). */
export interface UpdateUserProfileRequest {
  name?: string;
  avatarUrl?: string;
  notificationPreferences?: {
    budgetLimitAlerts?: boolean;
    goalReminders?: boolean;
    weeklySummaryEmails?: boolean;
  };
}

/** §2.4 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/** §2.7 */
export interface ClearAllUserDataRequest {
  confirmation: string;
}
