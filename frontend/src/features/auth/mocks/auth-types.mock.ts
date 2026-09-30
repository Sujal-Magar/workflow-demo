// Phase 5 stand-in for the shape schemas and types of `@workflow-demo/contracts` (contract.md §2, §3, §6).
// Deleted in INT-05, when every import switches to the contract package.
import { z } from "zod";

/** contract.md §3 Error Code Catalog. */
export const AUTH_ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_RESET_TOKEN: "INVALID_RESET_TOKEN",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  INVALID_GOOGLE_TOKEN: "INVALID_GOOGLE_TOKEN",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  EMAIL_ALREADY_EXISTS: "EMAIL_ALREADY_EXISTS",
  NOT_FOUND: "NOT_FOUND",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

const errorCodeValues = Object.values(AUTH_ERROR_CODES) as [AuthErrorCode, ...AuthErrorCode[]];

/** §2.1 */
export const publicUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
});

/** §2.2 */
export const sessionPayloadSchema = z.object({
  user: publicUserSchema,
  accessToken: z.string(),
  expiresIn: z.number().int(),
});

/** §2.3 */
export const successAckSchema = z.object({
  success: z.literal(true),
});

/** §2.4 */
export const forgotPasswordAckSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

/** §2.5 */
export const errorBodySchema = z.object({
  code: z.enum(errorCodeValues),
  message: z.string(),
  fieldErrors: z.record(z.string(), z.string()).optional(),
});

/** §6.5 success body. */
export const currentUserResponseSchema = z.object({
  user: publicUserSchema,
});

export type PublicUser = z.infer<typeof publicUserSchema>;
export type SessionPayload = z.infer<typeof sessionPayloadSchema>;
export type SuccessAck = z.infer<typeof successAckSchema>;
export type ForgotPasswordAck = z.infer<typeof forgotPasswordAckSchema>;
export type ErrorBody = z.infer<typeof errorBodySchema>;
export type CurrentUserResponse = z.infer<typeof currentUserResponseSchema>;

/** §6 request bodies (validated by the rule sets in `auth-form-schemas.mock.ts`). */
export interface SignUpRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface GoogleSignInRequest {
  token: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface NewPasswordFields {
  password: string;
  confirmPassword: string;
}

export interface ResetPasswordRequest extends NewPasswordFields {
  token: string;
}
