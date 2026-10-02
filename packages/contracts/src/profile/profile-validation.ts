import { z } from "zod";

import { strongPasswordSchema } from "../auth/auth-validation";

export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 100;
export const CLEAR_DATA_CONFIRMATION_LITERAL = "DELETE";

/** Contract §4 validation messages (verbatim). */
export const PROFILE_VALIDATION_MESSAGES = {
  NAME_REQUIRED: "Name is required.",
  NAME_TOO_SHORT: "Name must be at least 2 characters.",
  NAME_TOO_LONG: "Name must be at most 100 characters.",
  AVATAR_URL_EMPTY: "Avatar URL cannot be empty.",
  CURRENT_PASSWORD_REQUIRED: "Current password is required.",
  CONFIRM_PASSWORD_REQUIRED: "Please confirm your password.",
  CLEAR_DATA_CONFIRMATION: "Type DELETE to confirm.",
  AT_LEAST_ONE_FIELD_REQUIRED: "At least one of name, avatarUrl, or notificationPreferences is required.",
} as const;

interface FieldRule {
  readonly isSatisfiedBy: (value: string) => boolean;
  readonly message: string;
}

const isNonEmpty = (value: string): boolean => value.length > 0;
const trimWhitespace = (value: string): string => value.trim();

/** Required single-string-field rule chain (same pattern as auth's internal `textField`). */
function requiredTextField(rules: readonly FieldRule[], normalize: (value: string) => string = (value) => value) {
  return z.custom<string>().transform((value, context) => {
    const received: unknown = value;
    const text = typeof received === "string" ? normalize(received) : "";
    const failedRule = rules.find((rule) => !rule.isSatisfiedBy(text));
    if (failedRule) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: failedRule.message });
    }
    return text;
  });
}

/**
 * Optional single-string-field rule chain: `undefined` passes through untouched (absent =
 * unchanged, contract §2.3); a present value (including `""`) runs the rule chain.
 */
function optionalTextField(rules: readonly FieldRule[], normalize: (value: string) => string = (value) => value) {
  return z
    .string()
    .optional()
    .superRefine((value, context) => {
      if (value === undefined) {
        return;
      }
      const text = normalize(value);
      const failedRule = rules.find((rule) => !rule.isSatisfiedBy(text));
      if (failedRule) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: failedRule.message });
      }
    })
    .transform((value) => (value === undefined ? undefined : normalize(value)));
}

const requiredRule = (message: string): FieldRule => ({ isSatisfiedBy: isNonEmpty, message });

/** Rule set `DisplayName` (contract §4). Not `auth`'s `Name` rule set — it has an upper bound (D-09). */
export const displayNameSchema = optionalTextField(
  [
    requiredRule(PROFILE_VALIDATION_MESSAGES.NAME_REQUIRED),
    {
      isSatisfiedBy: (value) => value.length >= DISPLAY_NAME_MIN_LENGTH,
      message: PROFILE_VALIDATION_MESSAGES.NAME_TOO_SHORT,
    },
    {
      isSatisfiedBy: (value) => value.length <= DISPLAY_NAME_MAX_LENGTH,
      message: PROFILE_VALIDATION_MESSAGES.NAME_TOO_LONG,
    },
  ],
  trimWhitespace
);

/** Rule set `AvatarUrl` (contract §4): absence is fine; an explicit empty string is not. */
export const avatarUrlSchema = optionalTextField([
  { isSatisfiedBy: isNonEmpty, message: PROFILE_VALIDATION_MESSAGES.AVATAR_URL_EMPTY },
]);

/** Rule set `CurrentPassword` (contract §4). */
export const currentPasswordSchema = requiredTextField([
  requiredRule(PROFILE_VALIDATION_MESSAGES.CURRENT_PASSWORD_REQUIRED),
]);

/** Rule set `ConfirmPasswordPresence` (contract §4): presence only; the match check is service-layer (§7 C6). */
export const confirmPasswordPresenceSchema = requiredTextField([
  requiredRule(PROFILE_VALIDATION_MESSAGES.CONFIRM_PASSWORD_REQUIRED),
]);

/** Rule set `ClearDataConfirmation` (contract §4): exact, case-sensitive literal match. */
export const clearDataConfirmationSchema = z.custom<string>().transform((value, context) => {
  const received: unknown = value;
  const text = typeof received === "string" ? received : "";
  if (text !== CLEAR_DATA_CONFIRMATION_LITERAL) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: PROFILE_VALIDATION_MESSAGES.CLEAR_DATA_CONFIRMATION });
  }
  return text;
});

const notificationPreferencesPatchSchema = z
  .object({
    budgetLimitAlerts: z.boolean().optional(),
    goalReminders: z.boolean().optional(),
    weeklySummaryEmails: z.boolean().optional(),
  })
  .optional();

/** Composed set `UpdateUserProfileRequest` (contract §2.3, §4). Unknown fields are stripped (contract §1). */
export const updateUserProfileRequestSchema = z
  .object({
    name: displayNameSchema,
    avatarUrl: avatarUrlSchema,
    notificationPreferences: notificationPreferencesPatchSchema,
  })
  .superRefine((value, context) => {
    const notificationPreferences = value.notificationPreferences;
    const hasNotificationPreferences =
      notificationPreferences !== undefined &&
      (notificationPreferences.budgetLimitAlerts !== undefined ||
        notificationPreferences.goalReminders !== undefined ||
        notificationPreferences.weeklySummaryEmails !== undefined);
    if (value.name === undefined && value.avatarUrl === undefined && !hasNotificationPreferences) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: PROFILE_VALIDATION_MESSAGES.AT_LEAST_ONE_FIELD_REQUIRED,
      });
    }
  });

/** Composed set `ChangePasswordRequest` (contract §2.4, §4). `NewStrongPassword` reuses `auth`'s rule set (D-07). */
export const changePasswordRequestSchema = z.object({
  currentPassword: currentPasswordSchema,
  newPassword: strongPasswordSchema,
  confirmPassword: confirmPasswordPresenceSchema,
});

/** Composed set `ClearAllUserDataRequest` (contract §2.7, §4). */
export const clearAllUserDataRequestSchema = z.object({
  confirmation: clearDataConfirmationSchema,
});

export type UpdateUserProfileRequest = z.infer<typeof updateUserProfileRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
export type ClearAllUserDataRequest = z.infer<typeof clearAllUserDataRequestSchema>;
