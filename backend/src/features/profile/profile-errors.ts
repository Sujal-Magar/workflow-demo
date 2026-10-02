import { ERROR_CODES } from "@workflow-demo/contracts";

import { DomainError } from "../../shared/errors/domain-error";

export class PasswordNotSetError extends DomainError {
  readonly code = ERROR_CODES.PASSWORD_NOT_SET;

  constructor() {
    super("No password is set for this account. Use password recovery instead.");
  }
}

export class SamePasswordError extends DomainError {
  readonly code = ERROR_CODES.SAME_PASSWORD;

  constructor() {
    super("New password must be different from your current password.");
  }
}

export class PasswordsDoNotMatchError extends DomainError {
  readonly code = ERROR_CODES.PASSWORDS_DO_NOT_MATCH;

  constructor() {
    super("New password and confirmation do not match.");
  }
}

export class RateLimitExceededError extends DomainError {
  readonly code = ERROR_CODES.RATE_LIMIT_EXCEEDED;

  constructor() {
    super("Too many password change attempts. Please try again later.");
  }
}
