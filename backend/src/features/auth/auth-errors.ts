import { ERROR_CODES } from "@workflow-demo/contracts";

import { DomainError } from "../../shared/errors/domain-error";

export class InvalidResetTokenError extends DomainError {
  readonly code = ERROR_CODES.INVALID_RESET_TOKEN;

  constructor() {
    super("The password reset token is unknown, expired or already used.");
  }
}

export class InvalidCredentialsError extends DomainError {
  readonly code = ERROR_CODES.INVALID_CREDENTIALS;

  constructor() {
    super("The email and password do not match an account with a password.");
  }
}

export class InvalidGoogleTokenError extends DomainError {
  readonly code = ERROR_CODES.INVALID_GOOGLE_TOKEN;

  constructor(reason: string) {
    super(`Google sign-in rejected: ${reason}`);
  }
}

export class UnauthenticatedError extends DomainError {
  readonly code = ERROR_CODES.UNAUTHENTICATED;

  constructor(reason = "A valid access token or refresh token is required.") {
    super(reason);
  }
}

export class EmailAlreadyExistsError extends DomainError {
  readonly code = ERROR_CODES.EMAIL_ALREADY_EXISTS;

  constructor() {
    super("An account with this email already exists.");
  }
}
