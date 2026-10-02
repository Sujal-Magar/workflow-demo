// Phase 5 stand-in for the shared validation rule sets of `@workflow-demo/contracts` (contract.md §4).
// Rules per field run in the listed order, so the first issue for a field is its first failing rule.
// Deleted in INT-02/INT-03, when every form resolves with the contract package's schemas.
import { z } from "zod";

export const VALIDATION_MESSAGES = {
  nameEmpty: "Name is required.",
  nameTooShort: "Name must be at least 2 characters.",
  nameTooLong: "Name must be at most 100 characters.",
  avatarUrlEmpty: "Avatar URL cannot be empty.",
  currentPasswordEmpty: "Current password is required.",
  passwordEmpty: "Password is required.",
  passwordTooShort: "Password must be at least 8 characters.",
  passwordNoNumber: "Password must include a number.",
  passwordNoSpecial: "Password must include a special character.",
  confirmPasswordEmpty: "Please confirm your password.",
  clearDataConfirmation: "Type DELETE to confirm.",
} as const;

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 100;
const PASSWORD_MIN_LENGTH = 8;
const DIGIT_PATTERN = /[0-9]/;
const SPECIAL_CHARACTER_PATTERN = /[^A-Za-z0-9]/;

function requiredString(emptyMessage: string) {
  return z.string({ required_error: emptyMessage, invalid_type_error: emptyMessage });
}

/** `DisplayName` (contract §4): trimmed before checking and storing, its own 2–100 rule set (D-09). */
export const displayNameSchema = requiredString(VALIDATION_MESSAGES.nameEmpty)
  .trim()
  .min(1, VALIDATION_MESSAGES.nameEmpty)
  .min(NAME_MIN_LENGTH, VALIDATION_MESSAGES.nameTooShort)
  .max(NAME_MAX_LENGTH, VALIDATION_MESSAGES.nameTooLong);

/** `AvatarUrl` (contract §4): absence is fine; an explicit empty string is not. */
export const avatarUrlSchema = requiredString(VALIDATION_MESSAGES.avatarUrlEmpty).min(
  1,
  VALIDATION_MESSAGES.avatarUrlEmpty
);

/** `CurrentPassword` (contract §4). */
export const currentPasswordSchema = requiredString(VALIDATION_MESSAGES.currentPasswordEmpty).min(
  1,
  VALIDATION_MESSAGES.currentPasswordEmpty
);

/** `NewStrongPassword` (contract §4): reused verbatim from `auth`'s `StrongPassword` rule set (D-07). */
export const newStrongPasswordSchema = requiredString(VALIDATION_MESSAGES.passwordEmpty)
  .min(1, VALIDATION_MESSAGES.passwordEmpty)
  .min(PASSWORD_MIN_LENGTH, VALIDATION_MESSAGES.passwordTooShort)
  .regex(DIGIT_PATTERN, VALIDATION_MESSAGES.passwordNoNumber)
  .regex(SPECIAL_CHARACTER_PATTERN, VALIDATION_MESSAGES.passwordNoSpecial);

/** `ConfirmPasswordPresence` (contract §4): the match check is a separate, later (server-side) step. */
export const confirmPasswordPresenceSchema = requiredString(VALIDATION_MESSAGES.confirmPasswordEmpty).min(
  1,
  VALIDATION_MESSAGES.confirmPasswordEmpty
);

/** `ClearDataConfirmation` (contract §4): must be exactly `"DELETE"`. */
export const clearDataConfirmationSchema = z.literal("DELETE", {
  errorMap: () => ({ message: VALIDATION_MESSAGES.clearDataConfirmation }),
});

/** `UpdateUserProfileRequest` (contract §4): every field optional; at least one must be present (checked by the dialog/toggle callers, not here, since each caller only ever sends the field(s) relevant to it). */
export const editProfileFormSchema = z.object({
  name: displayNameSchema,
  avatarUrl: z.union([avatarUrlSchema, z.literal("")]),
});

/** `ChangePasswordRequest` (contract §4, contract/Zod layer only). */
export const changePasswordFormSchema = z.object({
  currentPassword: currentPasswordSchema,
  newPassword: newStrongPasswordSchema,
  confirmPassword: confirmPasswordPresenceSchema,
});

/** `ClearAllUserDataRequest` (contract §4). */
export const clearAllUserDataFormSchema = z.object({
  confirmation: clearDataConfirmationSchema,
});

export type EditProfileFormValues = z.input<typeof editProfileFormSchema>;
export type ChangePasswordFormValues = z.input<typeof changePasswordFormSchema>;
export type ClearAllUserDataFormValues = z.input<typeof clearAllUserDataFormSchema>;
