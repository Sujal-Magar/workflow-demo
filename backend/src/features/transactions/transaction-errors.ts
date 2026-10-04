import { ERROR_CODES } from "@workflow-demo/contracts";

import { DomainError } from "../../shared/errors/domain-error";

export class TransactionNotFoundError extends DomainError {
  readonly code = ERROR_CODES.NOT_FOUND;

  constructor() {
    super("No transaction with that id exists for this user.");
  }
}
