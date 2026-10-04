import { ERROR_CODES, errorBodySchema, type ErrorCode } from "@workflow-demo/contracts";

/** The four operations of contract.md §6. */
export type TransactionOperation = "getTransactions" | "createTransaction" | "updateTransaction" | "deleteTransaction";

export type FieldErrors = Readonly<Record<string, string>>;

export type TransactionFailure =
  | { readonly kind: "field-errors"; readonly fieldErrors: FieldErrors }
  | { readonly kind: "not-found" }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "unexpected" };

export type TransactionResult<T> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly failure: TransactionFailure };

/** What an operation produced before interpretation: an HTTP response, or no response at all. */
export type RawOutcome =
  { readonly kind: "response"; readonly status: number; readonly body: unknown } | { readonly kind: "network-error" };

type DeclaredFailureKind = Exclude<TransactionFailure["kind"], "unexpected">;

interface DeclaredError {
  readonly status: number;
  readonly code: ErrorCode;
  readonly kind: DeclaredFailureKind;
}

const VALIDATION: DeclaredError = { status: 400, code: ERROR_CODES.VALIDATION_ERROR, kind: "field-errors" };
const NOT_FOUND: DeclaredError = { status: 404, code: ERROR_CODES.NOT_FOUND, kind: "not-found" };

/** Declared error responses per operation (contract.md §5, §6). Anything else is "unexpected". */
const DECLARED_ERRORS: Readonly<Record<TransactionOperation, readonly DeclaredError[]>> = {
  getTransactions: [VALIDATION],
  createTransaction: [VALIDATION],
  updateTransaction: [VALIDATION, NOT_FOUND],
  deleteTransaction: [NOT_FOUND],
};

/** Form fields that can display a `fieldErrors` entry for each operation. */
export const OPERATION_FORM_FIELDS: Readonly<Record<TransactionOperation, readonly string[]>> = {
  getTransactions: ["page", "limit", "category", "type", "timeframe", "sort"],
  createTransaction: ["date", "description", "category", "type", "amount"],
  updateTransaction: ["date", "description", "category", "type", "amount"],
  deleteTransaction: [],
};

const UNEXPECTED: TransactionFailure = { kind: "unexpected" };
const UNAUTHENTICATED: TransactionFailure = { kind: "unauthenticated" };

/**
 * Maps a non-success outcome of `operation` to the failure union. Undeclared statuses or codes, network
 * failures, malformed bodies, and a `VALIDATION_ERROR` with nothing to show on `formFields` are "unexpected".
 * A `401 UNAUTHENTICATED` is declared for every operation implicitly (contract §1) and is never "unexpected".
 */
export function toTransactionFailure(
  operation: TransactionOperation,
  outcome: RawOutcome,
  formFields: readonly string[] = OPERATION_FORM_FIELDS[operation]
): TransactionFailure {
  if (outcome.kind === "network-error") {
    return UNEXPECTED;
  }
  const parsedBody = errorBodySchema.safeParse(outcome.body);
  if (!parsedBody.success) {
    return UNEXPECTED;
  }
  const { code, fieldErrors } = parsedBody.data;
  if (outcome.status === 401 && code === ERROR_CODES.UNAUTHENTICATED) {
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
