import { z } from "zod";

export const NAME_MIN_LENGTH = 2;
export const PASSWORD_MIN_LENGTH = 8;

/** FDS §5 validation messages (verbatim) plus the API-only token message (contract C1). */
export const AUTH_VALIDATION_MESSAGES = {
  NAME_REQUIRED: "Name is required.",
  NAME_TOO_SHORT: "Name must be at least 2 characters.",
  EMAIL_REQUIRED: "Email is required.",
  EMAIL_INVALID: "Enter a valid email address.",
  PASSWORD_REQUIRED: "Password is required.",
  PASSWORD_TOO_SHORT: "Password must be at least 8 characters.",
  PASSWORD_NEEDS_NUMBER: "Password must include a number.",
  PASSWORD_NEEDS_SPECIAL_CHARACTER: "Password must include a special character.",
  CONFIRM_PASSWORD_REQUIRED: "Please confirm your password.",
  PASSWORDS_DO_NOT_MATCH: "Passwords do not match.",
  TOKEN_REQUIRED: "Token is required.",
} as const;

interface FieldRule {
  readonly isSatisfiedBy: (value: string) => boolean;
  readonly message: string;
}

const ASCII_DIGIT_PATTERN = /[0-9]/;
// Anything that is not an ASCII letter or digit is special, including space, underscore and "é".
const SPECIAL_CHARACTER_PATTERN = /[^A-Za-z0-9]/;
const emailFormatSchema = z.string().email();

const isNonEmpty = (value: string): boolean => value.length > 0;
const trimWhitespace = (value: string): string => value.trim();
const keepAsIs = (value: string): string => value;

/**
 * Builds a single-field rule set. The declared input type is `string` (what the contract sends),
 * but any absent, `null` or non-string value is treated as an empty string, so it reports the
 * "empty" message instead of a type error. Rules run in order and only the first failing rule is
 * reported. Issues are never fatal, so object-level checks (the password match) still run.
 */
function textField(rules: readonly FieldRule[], normalize: (value: string) => string = keepAsIs) {
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

const requiredRule = (message: string): FieldRule => ({ isSatisfiedBy: isNonEmpty, message });

/** Rule set `Name`. Trimmed before checking; the trimmed value is what gets stored. */
export const nameSchema = textField(
  [
    requiredRule(AUTH_VALIDATION_MESSAGES.NAME_REQUIRED),
    { isSatisfiedBy: (value) => value.length >= NAME_MIN_LENGTH, message: AUTH_VALIDATION_MESSAGES.NAME_TOO_SHORT },
  ],
  trimWhitespace
);

/** Rule set `Email`. Trimmed before checking. Lowercasing is the server's job, not the rule's. */
export const emailSchema = textField(
  [
    requiredRule(AUTH_VALIDATION_MESSAGES.EMAIL_REQUIRED),
    {
      isSatisfiedBy: (value) => emailFormatSchema.safeParse(value).success,
      message: AUTH_VALIDATION_MESSAGES.EMAIL_INVALID,
    },
  ],
  trimWhitespace
);

/** Rule set `StrongPassword`. Never trimmed. */
export const strongPasswordSchema = textField([
  requiredRule(AUTH_VALIDATION_MESSAGES.PASSWORD_REQUIRED),
  {
    isSatisfiedBy: (value) => value.length >= PASSWORD_MIN_LENGTH,
    message: AUTH_VALIDATION_MESSAGES.PASSWORD_TOO_SHORT,
  },
  {
    isSatisfiedBy: (value) => ASCII_DIGIT_PATTERN.test(value),
    message: AUTH_VALIDATION_MESSAGES.PASSWORD_NEEDS_NUMBER,
  },
  {
    isSatisfiedBy: (value) => SPECIAL_CHARACTER_PATTERN.test(value),
    message: AUTH_VALIDATION_MESSAGES.PASSWORD_NEEDS_SPECIAL_CHARACTER,
  },
]);

/** Rule set `LoginPassword`: no strength check on existing credentials. */
export const loginPasswordSchema = textField([requiredRule(AUTH_VALIDATION_MESSAGES.PASSWORD_REQUIRED)]);

/** Rule set `ConfirmPassword`, field-level part. The match rule is applied by the composed sets. */
export const confirmPasswordSchema = textField([requiredRule(AUTH_VALIDATION_MESSAGES.CONFIRM_PASSWORD_REQUIRED)]);

/** Rule set `Token`. Never trimmed. */
export const tokenSchema = textField([requiredRule(AUTH_VALIDATION_MESSAGES.TOKEN_REQUIRED)]);

interface PasswordPair {
  readonly password: string;
  readonly confirmPassword: string;
}

/**
 * Second `ConfirmPassword` rule. Runs even when other fields failed. It is skipped when
 * `confirmPassword` is empty, because that field already reports its "empty" message.
 */
function checkPasswordsMatch(fields: PasswordPair, context: z.RefinementCtx): void {
  if (fields.confirmPassword !== "" && fields.confirmPassword !== fields.password) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["confirmPassword"],
      message: AUTH_VALIDATION_MESSAGES.PASSWORDS_DO_NOT_MATCH,
    });
  }
}

const newPasswordFieldsShape = {
  password: strongPasswordSchema,
  confirmPassword: confirmPasswordSchema,
};

/** Composed set `SignUpRequest`. */
export const signUpRequestSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    ...newPasswordFieldsShape,
  })
  .superRefine(checkPasswordsMatch);

/** Composed set `SignInRequest`. */
export const signInRequestSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
});

/** Composed set `GoogleSignInRequest`. */
export const googleSignInRequestSchema = z.object({
  token: tokenSchema,
});

/** Composed set `ForgotPasswordRequest`. */
export const forgotPasswordRequestSchema = z.object({
  email: emailSchema,
});

/** Composed set `NewPasswordFields`, used on its own by the Reset Password form. */
export const newPasswordFieldsSchema = z.object(newPasswordFieldsShape).superRefine(checkPasswordsMatch);

/** Composed set `ResetPasswordRequest`: `token` plus all of `NewPasswordFields`. */
export const resetPasswordRequestSchema = z
  .object({
    token: tokenSchema,
    ...newPasswordFieldsShape,
  })
  .superRefine(checkPasswordsMatch);

export type SignUpRequest = z.infer<typeof signUpRequestSchema>;
export type SignInRequest = z.infer<typeof signInRequestSchema>;
export type GoogleSignInRequest = z.infer<typeof googleSignInRequestSchema>;
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;
export type NewPasswordFields = z.infer<typeof newPasswordFieldsSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;
