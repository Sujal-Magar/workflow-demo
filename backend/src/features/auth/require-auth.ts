import type { NextFunction, Request, RequestHandler, Response } from "express";

import { UnauthenticatedError } from "./auth-errors";
import type { AccessTokenSigner } from "./ports/access-token-signer";

// Exactly "Bearer <token>": case-sensitive scheme, one space, a token without whitespace.
const BEARER_HEADER_PATTERN = /^Bearer (\S+)$/;

function readBearerToken(authorizationHeader: string | undefined): string | null {
  const match = authorizationHeader === undefined ? null : BEARER_HEADER_PATTERN.exec(authorizationHeader);
  return match?.[1] ?? null;
}

/**
 * Presentation middleware for every protected route (REQ-AUTH-08). Verifies the Bearer access
 * token without a database lookup and sets `req.userId`; any failure becomes
 * `401 UNAUTHENTICATED` through the error handler.
 */
export function createRequireAuth(accessTokenSigner: AccessTokenSigner): RequestHandler {
  return async (request: Request, _response: Response, next: NextFunction): Promise<void> => {
    const token = readBearerToken(request.headers.authorization);
    const userId = token === null ? null : await accessTokenSigner.verify(token);
    if (userId === null) {
      next(new UnauthenticatedError("A valid Bearer access token is required."));
      return;
    }
    request.userId = userId;
    next();
  };
}

/** The authenticated user id set by `requireAuth`, for handlers to pass to services. */
export function getAuthenticatedUserId(request: Request): string {
  if (request.userId === undefined) {
    throw new UnauthenticatedError("The request has no authenticated user.");
  }
  return request.userId;
}
