import { z } from "zod";

/** Every error code the API can return (contract §3). Other features reuse this catalog. */
export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_RESET_TOKEN: "INVALID_RESET_TOKEN",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  INVALID_GOOGLE_TOKEN: "INVALID_GOOGLE_TOKEN",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  EMAIL_ALREADY_EXISTS: "EMAIL_ALREADY_EXISTS",
  NOT_FOUND: "NOT_FOUND",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  PASSWORD_NOT_SET: "PASSWORD_NOT_SET",
  SAME_PASSWORD: "SAME_PASSWORD",
  PASSWORDS_DO_NOT_MATCH: "PASSWORDS_DO_NOT_MATCH",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Fixed, informational `message` per code (contract §3). Clients never display it. */
export const ERROR_MESSAGES: Readonly<Record<ErrorCode, string>> = {
  VALIDATION_ERROR: "Request validation failed.",
  INVALID_RESET_TOKEN: "This reset link is invalid or has expired.",
  INVALID_CREDENTIALS: "Invalid email or password.",
  INVALID_GOOGLE_TOKEN: "Google sign-in failed.",
  UNAUTHENTICATED: "Authentication required.",
  EMAIL_ALREADY_EXISTS: "An account with this email already exists.",
  NOT_FOUND: "Route not found.",
  INTERNAL_ERROR: "An unexpected error occurred.",
  PASSWORD_NOT_SET: "No password is set for this account. Use password recovery instead.",
  SAME_PASSWORD: "New password must be different from your current password.",
  PASSWORDS_DO_NOT_MATCH: "New password and confirmation do not match.",
  RATE_LIMIT_EXCEEDED: "Too many password change attempts. Please try again later.",
};

/**
 * Body of every non-2xx response (contract §2.5). `code` is typed as a plain string so that
 * clients must treat codes they do not know as "unexpected" (contract §1).
 */
export const errorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
  fieldErrors: z.record(z.string(), z.string()).optional(),
});

export type ErrorBody = z.infer<typeof errorBodySchema>;

export type FieldErrors = Record<string, string>;
