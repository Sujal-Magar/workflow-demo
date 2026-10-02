import { z } from "zod";

/** Contract §2.1. `preferredCurrency` default `"NPR"`. */
export const PREFERRED_CURRENCIES = ["NPR", "USD", "EUR", "GBP"] as const;

/** Contract §2.1. `language` default `"en_US"`. */
export const LANGUAGES = ["en_US", "en_GB", "es", "fr"] as const;

export const MONTHLY_START_DATE_MIN = 1;
export const MONTHLY_START_DATE_MAX = 28;

/** Contract §2.2. */
export const notificationPreferencesSchema = z.object({
  budgetLimitAlerts: z.boolean(),
  goalReminders: z.boolean(),
  weeklySummaryEmails: z.boolean(),
});

/** Contract §2.1. `id` equals the account's user id (D-04). */
export const userProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  preferredCurrency: z.enum(PREFERRED_CURRENCIES),
  language: z.enum(LANGUAGES),
  monthlyStartDate: z.number().int().min(MONTHLY_START_DATE_MIN).max(MONTHLY_START_DATE_MAX),
  notificationPreferences: notificationPreferencesSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Contract §2.5. Success body for `changePassword` and `clearAllUserData`. */
export const profileSuccessAckSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type ProfileSuccessAck = z.infer<typeof profileSuccessAckSchema>;
