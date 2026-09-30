import { createExpressEndpoints, initServer } from "@ts-rest/express";
import { authContract, type SessionPayload } from "@workflow-demo/contracts";
import express, { type RequestHandler, type Router } from "express";

import { handleRequestValidationError } from "../../shared/http/validation-error";
import { UnauthenticatedError } from "./auth-errors";
import type { AuthService, AuthenticatedSession } from "./auth-service";
import type { PasswordResetService } from "./password-reset-service";
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from "./refresh-cookie";
import { getAuthenticatedUserId } from "./require-auth";

export interface AuthRouterDependencies {
  readonly authService: AuthService;
  readonly passwordResetService: PasswordResetService;
  readonly requireAuth: RequestHandler;
  /** Adds the `Secure` flag to the refresh cookie (production only). */
  readonly isSecureCookie: boolean;
}

/** The response body never carries the raw refresh token; it goes to the cookie only. */
function toSessionPayload(session: AuthenticatedSession): SessionPayload {
  return { user: session.user, accessToken: session.accessToken, expiresIn: session.expiresIn };
}

/**
 * The eight `auth` operations (contract §6). Handlers stay thin: read the body, cookie or user
 * id, call a service, set or clear the cookie, and return the declared status. Domain errors
 * propagate to the app error handler. Routes carry their full `/api/v1/auth/...` path from the
 * contract, so the router is mounted without a prefix.
 */
export function createAuthRouter(dependencies: AuthRouterDependencies): Router {
  const { authService, passwordResetService, requireAuth, isSecureCookie } = dependencies;
  const server = initServer();

  const routes = server.router(authContract, {
    register: async ({ body, res }) => {
      const session = await authService.register(body);
      setRefreshCookie(res, session.refreshToken, isSecureCookie);
      return { status: 201, body: toSessionPayload(session) };
    },
    login: async ({ body, res }) => {
      const session = await authService.login(body);
      setRefreshCookie(res, session.refreshToken, isSecureCookie);
      return { status: 200, body: toSessionPayload(session) };
    },
    googleOAuthLogin: async ({ body, res }) => {
      const session = await authService.signInWithGoogle(body.token);
      setRefreshCookie(res, session.refreshToken, isSecureCookie);
      return { status: 200, body: toSessionPayload(session) };
    },
    refreshSession: async ({ req, res }) => {
      try {
        const session = await authService.refreshSession(readRefreshCookie(req));
        setRefreshCookie(res, session.refreshToken, isSecureCookie);
        return { status: 200, body: toSessionPayload(session) };
      } catch (error) {
        if (error instanceof UnauthenticatedError) {
          clearRefreshCookie(res, isSecureCookie);
        }
        throw error;
      }
    },
    getCurrentUser: {
      middleware: [requireAuth],
      handler: async ({ req }) => {
        const user = await authService.getCurrentUser(getAuthenticatedUserId(req));
        return { status: 200, body: { user } };
      },
    },
    logout: async ({ req, res }) => {
      try {
        await authService.logout(readRefreshCookie(req));
      } finally {
        clearRefreshCookie(res, isSecureCookie);
      }
      return { status: 200, body: { success: true } };
    },
    requestPasswordReset: async ({ body }) => {
      const acknowledgement = await passwordResetService.requestPasswordReset(body.email);
      return { status: 200, body: acknowledgement };
    },
    resetPassword: async ({ body }) => {
      await passwordResetService.resetPassword({ token: body.token, password: body.password });
      return { status: 200, body: { success: true } };
    },
  });

  const router = express.Router();
  createExpressEndpoints(authContract, routes, router, {
    requestValidationErrorHandler: handleRequestValidationError,
  });
  return router;
}
