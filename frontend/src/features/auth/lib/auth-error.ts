import { AUTH_ERROR_CODES, errorBodySchema, type AuthErrorCode } from "../mocks/auth-types.mock";

/** The eight operations of contract.md §7. */
export type AuthOperation =
  | "register"
  | "login"
  | "googleOAuthLogin"
  | "refreshSession"
  | "getCurrentUser"
  | "logout"
  | "requestPasswordReset"
  | "resetPassword";

export type FieldErrors = Readonly<Record<string, string>>;

export type AuthFailure =
  | { readonly kind: "field-errors"; readonly fieldErrors: FieldErrors }
  | { readonly kind: "invalid-credentials" }
  | { readonly kind: "email-exists" }
  | { readonly kind: "invalid-google-token" }
  | { readonly kind: "invalid-reset-token" }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "unexpected" };

export type AuthResult<T> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly failure: AuthFailure };

/** What an operation produced before interpretation: an HTTP response, or no response at all. */
export type RawOutcome =
  { readonly kind: "response"; readonly status: number; readonly body: unknown } | { readonly kind: "network-error" };

type DeclaredFailureKind = Exclude<AuthFailure["kind"], "unexpected">;

interface DeclaredError {
  readonly status: number;
  readonly code: AuthErrorCode;
  readonly kind: DeclaredFailureKind;
}

const VALIDATION: DeclaredError = { status: 400, code: AUTH_ERROR_CODES.VALIDATION_ERROR, kind: "field-errors" };

/** Declared error responses per operation (contract.md §6, §7). Anything else is "unexpected". */
const DECLARED_ERRORS: Readonly<Record<AuthOperation, readonly DeclaredError[]>> = {
  register: [VALIDATION, { status: 409, code: AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS, kind: "email-exists" }],
  login: [VALIDATION, { status: 401, code: AUTH_ERROR_CODES.INVALID_CREDENTIALS, kind: "invalid-credentials" }],
  googleOAuthLogin: [
    VALIDATION,
    { status: 401, code: AUTH_ERROR_CODES.INVALID_GOOGLE_TOKEN, kind: "invalid-google-token" },
  ],
  refreshSession: [{ status: 401, code: AUTH_ERROR_CODES.UNAUTHENTICATED, kind: "unauthenticated" }],
  getCurrentUser: [{ status: 401, code: AUTH_ERROR_CODES.UNAUTHENTICATED, kind: "unauthenticated" }],
  logout: [],
  requestPasswordReset: [VALIDATION],
  resetPassword: [VALIDATION, { status: 400, code: AUTH_ERROR_CODES.INVALID_RESET_TOKEN, kind: "invalid-reset-token" }],
};

/** Form fields that can display a `fieldErrors` entry for each operation (the reset form has no `token` field). */
export const OPERATION_FORM_FIELDS: Readonly<Record<AuthOperation, readonly string[]>> = {
  register: ["name", "email", "password", "confirmPassword"],
  login: ["email", "password"],
  googleOAuthLogin: [],
  refreshSession: [],
  getCurrentUser: [],
  logout: [],
  requestPasswordReset: ["email"],
  resetPassword: ["password", "confirmPassword"],
};

const UNEXPECTED: AuthFailure = { kind: "unexpected" };

/**
 * Maps a non-success outcome of `operation` to the failure union. Undeclared statuses or codes, network
 * failures, malformed bodies, and a `VALIDATION_ERROR` with nothing to show on `formFields` are "unexpected".
 */
export function toAuthFailure(
  operation: AuthOperation,
  outcome: RawOutcome,
  formFields: readonly string[] = OPERATION_FORM_FIELDS[operation]
): AuthFailure {
  if (outcome.kind === "network-error") {
    return UNEXPECTED;
  }
  const parsedBody = errorBodySchema.safeParse(outcome.body);
  if (!parsedBody.success) {
    return UNEXPECTED;
  }
  const { code, fieldErrors } = parsedBody.data;
  const declared = DECLARED_ERRORS[operation].find((entry) => entry.status === outcome.status && entry.code === code);
  if (!declared) {
    return UNEXPECTED;
  }
  if (declared.kind !== "field-errors") {
    return { kind: declared.kind };
  }
  const receivedFieldErrors = fieldErrors ?? {};
  const hasDisplayableError = formFields.some((field) => typeof receivedFieldErrors[field] === "string");
  return hasDisplayableError ? { kind: "field-errors", fieldErrors: receivedFieldErrors } : UNEXPECTED;
}
