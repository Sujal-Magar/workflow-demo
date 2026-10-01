import { describe, expect, it } from "vitest";

import {
  AUTH_BASE_PATH,
  ERROR_CODES,
  ERROR_MESSAGES,
  authContract,
  errorBodySchema,
  publicUserSchema,
  sessionPayloadSchema,
} from "../index";

describe("authContract", () => {
  it("serves every operation at its full contract §6 path", () => {
    const routes = Object.fromEntries(
      Object.entries(authContract).map(([name, route]) => [name, `${route.method} ${route.path}`])
    );
    expect(AUTH_BASE_PATH).toBe("/api/v1/auth");
    expect(routes).toEqual({
      register: "POST /api/v1/auth/signup",
      login: "POST /api/v1/auth/login",
      googleOAuthLogin: "POST /api/v1/auth/google",
      refreshSession: "POST /api/v1/auth/refresh",
      getCurrentUser: "GET /api/v1/auth/me",
      logout: "POST /api/v1/auth/logout",
      requestPasswordReset: "POST /api/v1/auth/forgot-password",
      resetPassword: "POST /api/v1/auth/reset-password",
    });
  });

  it("declares every status of contract §7 plus the general 500", () => {
    const statuses = Object.fromEntries(
      Object.entries(authContract).map(([name, route]) => [name, Object.keys(route.responses).map(Number)])
    );
    expect(statuses).toEqual({
      register: [201, 400, 409, 500],
      login: [200, 400, 401, 500],
      googleOAuthLogin: [200, 400, 401, 500],
      refreshSession: [200, 401, 500],
      getCurrentUser: [200, 401, 500],
      logout: [200, 500],
      requestPasswordReset: [200, 400, 500],
      resetPassword: [200, 400, 500],
    });
  });
});

describe("shared shapes", () => {
  it("has a fixed message for every error code", () => {
    expect(Object.keys(ERROR_MESSAGES).sort()).toEqual(Object.values(ERROR_CODES).sort());
  });

  it("errorBodySchema accepts bodies with and without fieldErrors", () => {
    expect(errorBodySchema.safeParse({ code: "NOT_FOUND", message: "Route not found." }).success).toBe(true);
    expect(
      errorBodySchema.safeParse({
        code: "VALIDATION_ERROR",
        message: "x",
        fieldErrors: { email: "Email is required." },
      }).success
    ).toBe(true);
    expect(errorBodySchema.safeParse({ code: "X" }).success).toBe(false);
  });

  it("publicUserSchema strips any field other than id, name and email", () => {
    const parsed = publicUserSchema.parse({
      id: "5b7c1d1e-3f0e-4c3a-9a53-0e2a8f1b6c11",
      name: "A B",
      email: "a@b.co",
      passwordHash: "secret",
    });
    expect(Object.keys(parsed).sort()).toEqual(["email", "id", "name"]);
  });

  it("sessionPayloadSchema requires an integer expiresIn", () => {
    const user = { id: "5b7c1d1e-3f0e-4c3a-9a53-0e2a8f1b6c11", name: "A B", email: "a@b.co" };
    expect(sessionPayloadSchema.safeParse({ user, accessToken: "t", expiresIn: 900 }).success).toBe(true);
    expect(sessionPayloadSchema.safeParse({ user, accessToken: "t", expiresIn: 1.5 }).success).toBe(false);
  });
});
