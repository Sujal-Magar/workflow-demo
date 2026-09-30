// Phase 5 stand-in for the shared rule sets of `@workflow-demo/contracts` (contract.md §5, FDS §5 messages
// verbatim). Rules per field run in the listed order, so the first issue for a field is its first failing rule.
// Deleted in INT-04, when every form resolves with the contract package's schemas.
import { z } from "zod";

export const VALIDATION_MESSAGES = {
  nameEmpty: "Name is required.",
  nameTooShort: "Name must be at least 2 characters.",
  emailEmpty: "Email is required.",
  emailInvalid: "Enter a valid email address.",
  passwordEmpty: "Password is required.",
  passwordTooShort: "Password must be at least 8 characters.",
  passwordNoNumber: "Password must include a number.",
  passwordNoSpecial: "Password must include a special character.",
  confirmPasswordEmpty: "Please confirm your password.",
  passwordsDoNotMatch: "Passwords do not match.",
  tokenEmpty: "Token is required.",
} as const;

const NAME_MIN_LENGTH = 2;
const PASSWORD_MIN_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DIGIT_PATTERN = /[0-9]/;
const SPECIAL_CHARACTER_PATTERN = /[^A-Za-z0-9]/;

/** A string field whose absent or wrong-type value reports the "empty" message. */
function requiredString(emptyMessage: string) {
  return z.string({ required_error: emptyMessage, invalid_type_error: emptyMessage });
}

/** Name: trimmed first (D-05). */
export const nameSchema = requiredString(VALIDATION_MESSAGES.nameEmpty)
  .trim()
  .min(1, VALIDATION_MESSAGES.nameEmpty)
  .min(NAME_MIN_LENGTH, VALIDATION_MESSAGES.nameTooShort);

/** Email: trimmed first (D-05); lowercasing is the server's job. */
export const emailSchema = requiredString(VALIDATION_MESSAGES.emailEmpty)
  .trim()
  .min(1, VALIDATION_MESSAGES.emailEmpty)
  .regex(EMAIL_PATTERN, VALIDATION_MESSAGES.emailInvalid);

/** StrongPassword: never trimmed. */
export const strongPasswordSchema = requiredString(VALIDATION_MESSAGES.passwordEmpty)
  .min(1, VALIDATION_MESSAGES.passwordEmpty)
  .min(PASSWORD_MIN_LENGTH, VALIDATION_MESSAGES.passwordTooShort)
  .regex(DIGIT_PATTERN, VALIDATION_MESSAGES.passwordNoNumber)
  .regex(SPECIAL_CHARACTER_PATTERN, VALIDATION_MESSAGES.passwordNoSpecial);

/** LoginPassword: required only. */
export const loginPasswordSchema = requiredString(VALIDATION_MESSAGES.passwordEmpty).min(
  1,
  VALIDATION_MESSAGES.passwordEmpty
);

/** ConfirmPassword (empty rule; the match rule is applied on the composed set). */
export const confirmPasswordSchema = requiredString(VALIDATION_MESSAGES.confirmPasswordEmpty).min(
  1,
  VALIDATION_MESSAGES.confirmPasswordEmpty
);

/** Token: API-only message. */
export const tokenSchema = requiredString(VALIDATION_MESSAGES.tokenEmpty).min(1, VALIDATION_MESSAGES.tokenEmpty);

interface PasswordPair {
  password: string;
  confirmPassword: string;
}

/** ConfirmPassword rule 2, reported on `confirmPassword`; runs even when other fields have failed. */
function addPasswordMatchIssue(values: PasswordPair, context: z.RefinementCtx): void {
  if (values.confirmPassword.length > 0 && values.confirmPassword !== values.password) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["confirmPassword"],
      message: VALIDATION_MESSAGES.passwordsDoNotMatch,
    });
  }
}

const newPasswordFieldsShape = {
  password: strongPasswordSchema,
  confirmPassword: confirmPasswordSchema,
};

export const signUpRequestSchema = z
  .object({ name: nameSchema, email: emailSchema, ...newPasswordFieldsShape })
  .superRefine(addPasswordMatchIssue);

export const signInRequestSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
});

export const googleSignInRequestSchema = z.object({
  token: tokenSchema,
});

export const forgotPasswordRequestSchema = z.object({
  email: emailSchema,
});

export const newPasswordFieldsSchema = z.object(newPasswordFieldsShape).superRefine(addPasswordMatchIssue);

export const resetPasswordRequestSchema = z
  .object({ token: tokenSchema, ...newPasswordFieldsShape })
  .superRefine(addPasswordMatchIssue);

export type SignUpFormValues = z.input<typeof signUpRequestSchema>;
export type SignInFormValues = z.input<typeof signInRequestSchema>;
export type ForgotPasswordFormValues = z.input<typeof forgotPasswordRequestSchema>;
export type NewPasswordFormValues = z.input<typeof newPasswordFieldsSchema>;
