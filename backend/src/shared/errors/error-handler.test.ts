import type { NextFunction, Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EmailAlreadyExistsError,
  InvalidCredentialsError,
  InvalidGoogleTokenError,
  InvalidResetTokenError,
  UnauthenticatedError,
} from "../../features/auth/auth-errors";
import { ERROR_STATUS, errorHandler } from "./error-handler";

interface FakeResponse {
  headersSent: boolean;
  statusCode: number | null;
  jsonBody: unknown;
  status(code: number): FakeResponse;
  json(body: unknown): FakeResponse;
}

function fakeResponse(headersSent = false): FakeResponse {
  return {
    headersSent,
    statusCode: null,
    jsonBody: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.jsonBody = body;
      return this;
    },
  };
}

function handle(error: unknown, response: FakeResponse, next: NextFunction = vi.fn()): void {
  errorHandler(error, {} as Request, response as unknown as Response, next);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("errorHandler (BE-04, T-UA-08)", () => {
  it.each([
    [new InvalidResetTokenError(), 400, "INVALID_RESET_TOKEN", "This reset link is invalid or has expired."],
    [new InvalidCredentialsError(), 401, "INVALID_CREDENTIALS", "Invalid email or password."],
    [new InvalidGoogleTokenError("x"), 401, "INVALID_GOOGLE_TOKEN", "Google sign-in failed."],
    [new UnauthenticatedError(), 401, "UNAUTHENTICATED", "Authentication required."],
    [new EmailAlreadyExistsError(), 409, "EMAIL_ALREADY_EXISTS", "An account with this email already exists."],
  ])("maps %s to %i %s with the fixed message", (error, status, code, message) => {
    const response = fakeResponse();
    handle(error, response);
    expect(response.statusCode).toBe(status);
    expect(response.jsonBody).toEqual({ code, message });
  });

  it("maps a SyntaxError that is not a body-parser failure to 500", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = fakeResponse();
    handle(new SyntaxError("Unexpected token"), response);
    expect(response.statusCode).toBe(500);
    expect(response.jsonBody).toEqual({ code: "INTERNAL_ERROR", message: "An unexpected error occurred." });
  });

  it("delegates to Express when headers were already sent", () => {
    const next = vi.fn();
    const response = fakeResponse(true);
    const error = new Error("late failure");

    handle(error, response, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(response.statusCode).toBeNull();
  });

  it("declares a status for every contract error code", () => {
    expect(ERROR_STATUS).toEqual({
      VALIDATION_ERROR: 400,
      INVALID_RESET_TOKEN: 400,
      INVALID_CREDENTIALS: 401,
      INVALID_GOOGLE_TOKEN: 401,
      UNAUTHENTICATED: 401,
      EMAIL_ALREADY_EXISTS: 409,
      NOT_FOUND: 404,
      INTERNAL_ERROR: 500,
    });
  });
});
