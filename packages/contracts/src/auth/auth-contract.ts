import { initContract } from "@ts-rest/core";

import { errorBodySchema } from "../common/error-body";
import {
  currentUserResponseSchema,
  forgotPasswordAckSchema,
  sessionPayloadSchema,
  successAckSchema,
} from "./auth-shapes";
import {
  forgotPasswordRequestSchema,
  googleSignInRequestSchema,
  resetPasswordRequestSchema,
  signInRequestSchema,
  signUpRequestSchema,
} from "./auth-validation";

export const AUTH_BASE_PATH = "/api/v1/auth";

const c = initContract();

/**
 * The eight `auth` operations (contract §6–§7). Every route carries the full `/api/v1/auth/...`
 * path, and every status an operation may return is declared, including the general `500`.
 */
export const authContract = c.router(
  {
    register: {
      method: "POST",
      path: "/signup",
      body: signUpRequestSchema,
      responses: {
        201: sessionPayloadSchema,
        400: errorBodySchema,
        409: errorBodySchema,
        500: errorBodySchema,
      },
      summary: "Create an account and start a session",
    },
    login: {
      method: "POST",
      path: "/login",
      body: signInRequestSchema,
      responses: {
        200: sessionPayloadSchema,
        400: errorBodySchema,
        401: errorBodySchema,
        500: errorBodySchema,
      },
      summary: "Sign in with email and password",
    },
    googleOAuthLogin: {
      method: "POST",
      path: "/google",
      body: googleSignInRequestSchema,
      responses: {
        200: sessionPayloadSchema,
        400: errorBodySchema,
        401: errorBodySchema,
        500: errorBodySchema,
      },
      summary: "Sign in, link, or create an account with a Google ID token",
    },
    refreshSession: {
      method: "POST",
      path: "/refresh",
      body: c.noBody(),
      responses: {
        200: sessionPayloadSchema,
        401: errorBodySchema,
        500: errorBodySchema,
      },
      summary: "Restore or renew the session from the refresh cookie",
    },
    getCurrentUser: {
      method: "GET",
      path: "/me",
      responses: {
        200: currentUserResponseSchema,
        401: errorBodySchema,
        500: errorBodySchema,
      },
      summary: "Read the signed-in user (Bearer access token)",
    },
    logout: {
      method: "POST",
      path: "/logout",
      body: c.noBody(),
      responses: {
        200: successAckSchema,
        500: errorBodySchema,
      },
      summary: "End the session and clear the refresh cookie",
    },
    requestPasswordReset: {
      method: "POST",
      path: "/forgot-password",
      body: forgotPasswordRequestSchema,
      responses: {
        200: forgotPasswordAckSchema,
        400: errorBodySchema,
        500: errorBodySchema,
      },
      summary: "Request a password reset link",
    },
    resetPassword: {
      method: "POST",
      path: "/reset-password",
      body: resetPasswordRequestSchema,
      responses: {
        200: successAckSchema,
        400: errorBodySchema,
        500: errorBodySchema,
      },
      summary: "Set a new password with a reset token",
    },
  },
  {
    pathPrefix: AUTH_BASE_PATH,
    strictStatusCodes: true,
  }
);

export type AuthContract = typeof authContract;
