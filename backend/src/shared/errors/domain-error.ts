import type { ErrorCode } from "@workflow-demo/contracts";

/**
 * Base class for expected business failures raised by services. It carries a contract error
 * code and no HTTP status; the Presentation layer decides the status.
 */
export abstract class DomainError extends Error {
  abstract readonly code: ErrorCode;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
