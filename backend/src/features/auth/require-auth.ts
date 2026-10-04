import type { NextFunction, Response } from "express";

import { UnauthenticatedError } from "./auth-errors";
import type { AccessTokenSigner } from "./ports/access-token-signer";

// Exactly "Bearer <token>": case-sensitive scheme, one space, a token without whitespace.
const BEARER_HEADER_PATTERN = /^Bearer (\S+)$/;

/**
 * The minimal request shape `requireAuth`/`getAuthenticatedUserId` need. Deliberately narrower
 * than Express's `Request` so this works as middleware for ts-rest routes whose `TsRestRequest`
 * narrows/transforms `query` (e.g. transactions' `getTransactions`), which Express's
 * `ParsedQs`-typed `Request` is structurally incompatible with.
 */
export interface AuthenticatableRequest {
  headers: { authorization?: string };
  userId?: string;
}

export type RequireAuthMiddleware = (
  request: AuthenticatableRequest,
  response: Response,
  next: NextFunction
) => unknown;

function readBearerToken(authorizationHeader: string | undefined): string | null {
  const match = authorizationHeader === undefined ? null : BEARER_HEADER_PATTERN.exec(authorizationHeader);
  return match?.[1] ?? null;
}

/**
 * Presentation middleware for every protected route (REQ-AUTH-08). Verifies the Bearer access
 * token without a database lookup and sets `req.userId`; any failure becomes
 * `401 UNAUTHENTICATED` through the error handler.
 */
export function createRequireAuth(accessTokenSigner: AccessTokenSigner): RequireAuthMiddleware {
  return async (request, _response, next): Promise<void> => {
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

/**
 * The authenticated user id set by `requireAuth`, for handlers to pass to services. Accepts any
 * request-shaped object carrying `userId` (not just the plain Express `Request`) so ts-rest
 * handlers whose `TsRestRequest` has a narrowed, transformed `query` type (e.g. transactions'
 * `getTransactions`) can call it without a structural `query` mismatch.
 */
export function getAuthenticatedUserId(request: { userId?: string }): string {
  if (request.userId === undefined) {
    throw new UnauthenticatedError("The request has no authenticated user.");
  }
  return request.userId;
}
