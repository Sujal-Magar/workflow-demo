import type { RequestValidationError } from "@ts-rest/express";
import { ERROR_CODES, ERROR_MESSAGES, type ErrorBody, type FieldErrors } from "@workflow-demo/contracts";
import type { Request, Response } from "express";
import type { ZodError } from "zod";

const HTTP_BAD_REQUEST = 400;

/**
 * Keeps the first message reported for each body field (the first failing rule). Nested paths
 * are dot-joined (e.g. `notificationPreferences.budgetLimitAlerts`, contract §5.2); an issue with
 * no path (an object-level refinement, e.g. "at least one field required") is dropped, leaving
 * `fieldErrors` empty for that case.
 */
export function toFieldErrors(error: ZodError | null): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of error?.issues ?? []) {
    if (issue.path.length === 0) {
      continue;
    }
    const field = issue.path.join(".");
    if (!(field in fieldErrors)) {
      fieldErrors[field] = issue.message;
    }
  }
  return fieldErrors;
}

export function validationErrorBody(fieldErrors: FieldErrors): ErrorBody {
  return {
    code: ERROR_CODES.VALIDATION_ERROR,
    message: ERROR_MESSAGES.VALIDATION_ERROR,
    fieldErrors,
  };
}

/**
 * ts-rest request-validation handler: `400 VALIDATION_ERROR` with the first message per field.
 * Combines query and body issues (`transactions`' `getTransactions` validates query params; every
 * other existing route validates a body — the two never overlap on the same request).
 */
export function handleRequestValidationError(
  error: RequestValidationError,
  _request: Request,
  response: Response
): void {
  const fieldErrors = { ...toFieldErrors(error.query), ...toFieldErrors(error.body) };
  response.status(HTTP_BAD_REQUEST).json(validationErrorBody(fieldErrors));
}
