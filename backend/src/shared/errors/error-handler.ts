import { ERROR_CODES, ERROR_MESSAGES, type ErrorBody, type ErrorCode } from "@workflow-demo/contracts";
import type { NextFunction, Request, Response } from "express";

import { validationErrorBody } from "../http/validation-error";
import { DomainError } from "./domain-error";

/** HTTP status per contract error code (contract §3). */
export const ERROR_STATUS: Readonly<Record<ErrorCode, number>> = {
  VALIDATION_ERROR: 400,
  INVALID_RESET_TOKEN: 400,
  INVALID_CREDENTIALS: 401,
  INVALID_GOOGLE_TOKEN: 401,
  UNAUTHENTICATED: 401,
  EMAIL_ALREADY_EXISTS: 409,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
  PASSWORD_NOT_SET: 400,
  SAME_PASSWORD: 400,
  PASSWORDS_DO_NOT_MATCH: 400,
  RATE_LIMIT_EXCEEDED: 429,
};

const JSON_PARSE_FAILURE_TYPE = "entity.parse.failed";

function errorBodyFor(code: ErrorCode): ErrorBody {
  return { code, message: ERROR_MESSAGES[code] };
}

/** body-parser marks unparseable JSON with this `type` on a `SyntaxError`. */
function isMalformedJsonError(error: unknown): boolean {
  return error instanceof SyntaxError && "type" in error && error.type === JSON_PARSE_FAILURE_TYPE;
}

/** JSON `404 NOT_FOUND` for any method and path no route matched. */
export function notFoundHandler(_request: Request, response: Response): void {
  response.status(ERROR_STATUS.NOT_FOUND).json(errorBodyFor(ERROR_CODES.NOT_FOUND));
}

/**
 * Translates errors into the contract error shape. Domain errors get their fixed status and
 * message, unparseable JSON becomes `400 VALIDATION_ERROR` with empty `fieldErrors`, and anything
 * else is `500 INTERNAL_ERROR` without internal detail. Express needs all four parameters to treat
 * this as an error handler.
 */
export function errorHandler(error: unknown, _request: Request, response: Response, next: NextFunction): void {
  if (response.headersSent) {
    next(error);
    return;
  }
  if (error instanceof DomainError) {
    response.status(ERROR_STATUS[error.code]).json(errorBodyFor(error.code));
    return;
  }
  if (isMalformedJsonError(error)) {
    response.status(ERROR_STATUS.VALIDATION_ERROR).json(validationErrorBody({}));
    return;
  }
  console.error("Unexpected error while handling a request:", error);
  response.status(ERROR_STATUS.INTERNAL_ERROR).json(errorBodyFor(ERROR_CODES.INTERNAL_ERROR));
}
