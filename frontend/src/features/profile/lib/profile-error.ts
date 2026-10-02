import { PROFILE_ERROR_CODES, errorBodySchema, type ProfileErrorCode } from "../mocks/profile-types.mock";

/** The five operations of contract.md §6. */
export type ProfileOperation = "getProfile" | "updateProfile" | "changePassword" | "exportData" | "clearAllData";

export type FieldErrors = Readonly<Record<string, string>>;

export type ProfileFailure =
  | { readonly kind: "field-errors"; readonly fieldErrors: FieldErrors }
  | { readonly kind: "invalid-credentials" }
  | { readonly kind: "password-not-set" }
  | { readonly kind: "same-password" }
  | { readonly kind: "passwords-do-not-match" }
  | { readonly kind: "rate-limit-exceeded" }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "unexpected" };

export type ProfileResult<T> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly failure: ProfileFailure };

/** What an operation produced before interpretation: an HTTP response, or no response at all. */
export type RawOutcome =
  { readonly kind: "response"; readonly status: number; readonly body: unknown } | { readonly kind: "network-error" };

type DeclaredFailureKind = Exclude<ProfileFailure["kind"], "unexpected">;

interface DeclaredError {
  readonly status: number;
  readonly code: ProfileErrorCode;
  readonly kind: DeclaredFailureKind;
}

const VALIDATION: DeclaredError = { status: 400, code: PROFILE_ERROR_CODES.VALIDATION_ERROR, kind: "field-errors" };

/** Declared error responses per operation (contract.md §5, §6). Anything else is "unexpected". */
const DECLARED_ERRORS: Readonly<Record<ProfileOperation, readonly DeclaredError[]>> = {
  getProfile: [],
  updateProfile: [VALIDATION],
  changePassword: [
    VALIDATION,
    { status: 400, code: PROFILE_ERROR_CODES.PASSWORD_NOT_SET, kind: "password-not-set" },
    { status: 400, code: PROFILE_ERROR_CODES.SAME_PASSWORD, kind: "same-password" },
    { status: 400, code: PROFILE_ERROR_CODES.PASSWORDS_DO_NOT_MATCH, kind: "passwords-do-not-match" },
    { status: 401, code: PROFILE_ERROR_CODES.INVALID_CREDENTIALS, kind: "invalid-credentials" },
    { status: 429, code: PROFILE_ERROR_CODES.RATE_LIMIT_EXCEEDED, kind: "rate-limit-exceeded" },
  ],
  exportData: [],
  clearAllData: [VALIDATION],
};

/** Form fields that can display a `fieldErrors` entry for each operation. */
export const OPERATION_FORM_FIELDS: Readonly<Record<ProfileOperation, readonly string[]>> = {
  getProfile: [],
  updateProfile: ["name", "avatarUrl"],
  changePassword: ["currentPassword", "newPassword", "confirmPassword"],
  exportData: [],
  clearAllData: ["confirmation"],
};

const UNEXPECTED: ProfileFailure = { kind: "unexpected" };
const UNAUTHENTICATED: ProfileFailure = { kind: "unauthenticated" };

/**
 * Maps a non-success outcome of `operation` to the failure union. Undeclared statuses or codes, network
 * failures, malformed bodies, and a `VALIDATION_ERROR` with nothing to show on `formFields` are "unexpected".
 * A `401 UNAUTHENTICATED` is declared for every operation implicitly (contract §1) and is never "unexpected".
 */
export function toProfileFailure(
  operation: ProfileOperation,
  outcome: RawOutcome,
  formFields: readonly string[] = OPERATION_FORM_FIELDS[operation]
): ProfileFailure {
  if (outcome.kind === "network-error") {
    return UNEXPECTED;
  }
  const parsedBody = errorBodySchema.safeParse(outcome.body);
  if (!parsedBody.success) {
    return UNEXPECTED;
  }
  const { code, fieldErrors } = parsedBody.data;
  if (outcome.status === 401 && code === PROFILE_ERROR_CODES.UNAUTHENTICATED) {
    return UNAUTHENTICATED;
  }
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
