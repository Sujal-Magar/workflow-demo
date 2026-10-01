import type { RequestValidationError } from "@ts-rest/express";
import { ERROR_CODES, ERROR_MESSAGES, type ErrorBody, type FieldErrors } from "@workflow-demo/contracts";
import type { Request, Response } from "express";
import type { ZodError } from "zod";

const HTTP_BAD_REQUEST = 400;

/** Keeps the first message reported for each top-level body field (the first failing rule). */
export function toFieldErrors(error: ZodError | null): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of error?.issues ?? []) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in fieldErrors)) {
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

/** ts-rest request-validation handler: `400 VALIDATION_ERROR` with the first message per field. */
export function handleRequestValidationError(
  error: RequestValidationError,
  _request: Request,
  response: Response
): void {
  response.status(HTTP_BAD_REQUEST).json(validationErrorBody(toFieldErrors(error.body)));
}
