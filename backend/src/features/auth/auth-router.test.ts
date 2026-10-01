import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  STRONG_PASSWORD,
  readRefreshCookieValue,
  sendRequest,
  signUpBody,
  startTestApp,
  type JsonResponse,
  type RequestOptions,
  type TestApp,
} from "../../test-support/auth-test-harness";
import { GoogleAuthLibraryTokenVerifier } from "./ports/google-token-verifier";
import type { Mailer } from "./ports/mailer";

const BASE = "/api/v1/auth";
const FORGOT_ACK = { success: true, message: "If an account exists for that email, a reset link has been sent." };

let app: TestApp;

beforeEach(async () => {
  app = await startTestApp();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await app.close();
});

function call(path: string, options?: RequestOptions): Promise<JsonResponse> {
  return sendRequest(app.baseUrl, `${BASE}${path}`, options);
}

function validationError(fieldErrors: Record<string, string>) {
  return { code: "VALIDATION_ERROR", message: "Request validation failed.", fieldErrors };
}

function expectSessionPayload(response: JsonResponse, email: string): void {
  const body = response.body as Record<string, unknown>;
  expect(Object.keys(body).sort()).toEqual(["accessToken", "expiresIn", "user"]);
  expect(body.expiresIn).toBe(900);
  expect(typeof body.accessToken).toBe("string");
  const user = body.user as Record<string, unknown>;
  expect(Object.keys(user).sort()).toEqual(["email", "id", "name"]);
  expect(user.email).toBe(email);
  const refreshToken = readRefreshCookieValue(response);
  expect(refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(response.text).not.toContain(refreshToken ?? "no-cookie");
}

async function registerUser(email = "jane@example.com"): Promise<JsonResponse> {
  const response = await call("/signup", { body: signUpBody(email) });
  expect(response.status).toBe(201);
  return response;
}

describe("POST /signup (T-UA-08)", () => {
  it("201 with a SessionPayload, the refresh token only in the cookie", async () => {
    const response = await call("/signup", { body: signUpBody("Jane@Example.com") });

    expect(response.status).toBe(201);
    expect(response.headers.get("content-type")).toContain("application/json");
    expectSessionPayload(response, "jane@example.com");
    expect((response.body as { user: { name: string } }).user.name).toBe("Test User");
  });

  it("400 with every FDS §5 message verbatim, one per field", async () => {
    const response = await call("/signup", {
      body: { name: "A", email: "user@", password: "abcdefg1", confirmPassword: "different" },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      validationError({
        name: "Name must be at least 2 characters.",
        email: "Enter a valid email address.",
        password: "Password must include a special character.",
        confirmPassword: "Passwords do not match.",
      })
    );
  });

  it.each([
    [{ password: "abcdefgh!", confirmPassword: "abcdefgh!" }, { password: "Password must include a number." }],
    [{ password: "abcd1!x", confirmPassword: "abcd1!x" }, { password: "Password must be at least 8 characters." }],
    [{ name: "   " }, { name: "Name is required." }],
    [{ email: "" }, { email: "Email is required." }],
    [{ confirmPassword: "" }, { confirmPassword: "Please confirm your password." }],
  ])("400 for %j → %j", async (overrides, fieldErrors) => {
    const response = await call("/signup", { body: { ...signUpBody("jane@example.com"), ...overrides } });
    expect(response.status).toBe(400);
    expect(response.body).toEqual(validationError(fieldErrors));
  });

  it("missing fields → the required messages", async () => {
    const response = await call("/signup", { body: {} });
    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      validationError({
        name: "Name is required.",
        email: "Email is required.",
        password: "Password is required.",
        confirmPassword: "Please confirm your password.",
      })
    );
  });

  it("malformed JSON → 400 VALIDATION_ERROR with empty fieldErrors", async () => {
    const response = await call("/signup", { rawBody: '{"name": "A",' });
    expect(response.status).toBe(400);
    expect(response.body).toEqual(validationError({}));
  });

  it("409 EMAIL_ALREADY_EXISTS for a duplicate email in any case", async () => {
    await registerUser();
    const response = await call("/signup", { body: signUpBody("JANE@example.com") });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      code: "EMAIL_ALREADY_EXISTS",
      message: "An account with this email already exists.",
    });
    expect(readRefreshCookieValue(response)).toBeNull();
  });
});

describe("POST /login (T-UA-08)", () => {
  it("200 with a SessionPayload for any email case", async () => {
    await registerUser();
    const response = await call("/login", { body: { email: "JANE@example.com", password: STRONG_PASSWORD } });

    expect(response.status).toBe(200);
    expectSessionPayload(response, "jane@example.com");
  });

  it("400 with email and password messages", async () => {
    const response = await call("/login", { body: { email: "", password: "" } });
    expect(response.status).toBe(400);
    expect(response.body).toEqual(validationError({ email: "Email is required.", password: "Password is required." }));
  });

  it("malformed JSON → 400 VALIDATION_ERROR with empty fieldErrors", async () => {
    const response = await call("/login", { rawBody: "not json" });
    expect(response.status).toBe(400);
    expect(response.body).toEqual(validationError({}));
  });

  it("401 bodies for unknown email, wrong password and a Google-only account are byte-identical", async () => {
    await registerUser();
    app.googleVerifier.register("g-token", { googleId: "g-1", email: "google@example.com" });
    expect((await call("/google", { body: { token: "g-token" } })).status).toBe(200);

    const responses = await Promise.all([
      call("/login", { body: { email: "nobody@example.com", password: STRONG_PASSWORD } }),
      call("/login", { body: { email: "jane@example.com", password: "wrong-pass1!" } }),
      call("/login", { body: { email: "google@example.com", password: STRONG_PASSWORD } }),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ code: "INVALID_CREDENTIALS", message: "Invalid email or password." });
      expect(response.text).toBe(responses[0]?.text);
      expect(response.setCookies).toEqual([]);
    }
  });
});

describe("POST /google (T-UA-08)", () => {
  it("creates a new account → 200 SessionPayload", async () => {
    app.googleVerifier.register("g-token", { googleId: "g-1", email: "New@Example.com", name: "New Person" });

    const response = await call("/google", { body: { token: "g-token" } });

    expect(response.status).toBe(200);
    expectSessionPayload(response, "new@example.com");
    expect((response.body as { user: { name: string } }).user.name).toBe("New Person");
  });

  it("links an existing email account → 200 with that account", async () => {
    const registered = await registerUser();
    app.googleVerifier.register("g-token", { googleId: "g-1", email: "jane@example.com" });

    const response = await call("/google", { body: { token: "g-token" } });

    expect(response.status).toBe(200);
    expect((response.body as { user: unknown }).user).toEqual((registered.body as { user: unknown }).user);
  });

  it("a conflicting linked Google ID → 401 INVALID_GOOGLE_TOKEN", async () => {
    await registerUser();
    app.googleVerifier.register("first", { googleId: "g-1", email: "jane@example.com" });
    app.googleVerifier.register("second", { googleId: "g-2", email: "jane@example.com" });
    await call("/google", { body: { token: "first" } });

    const response = await call("/google", { body: { token: "second" } });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ code: "INVALID_GOOGLE_TOKEN", message: "Google sign-in failed." });
  });

  it("an unverified email → 401 INVALID_GOOGLE_TOKEN", async () => {
    app.googleVerifier.register("g-token", { googleId: "g-1", email: "a@b.co", emailVerified: false });
    const response = await call("/google", { body: { token: "g-token" } });
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ code: "INVALID_GOOGLE_TOKEN", message: "Google sign-in failed." });
  });

  it("an invalid token → 401 INVALID_GOOGLE_TOKEN", async () => {
    const response = await call("/google", { body: { token: "forged" } });
    expect(response.status).toBe(401);
    expect((response.body as { code: string }).code).toBe("INVALID_GOOGLE_TOKEN");
  });

  it.each([{}, { token: "" }])("missing or empty token %j → 400 Token is required.", async (body) => {
    const response = await call("/google", { body });
    expect(response.status).toBe(400);
    expect(response.body).toEqual(validationError({ token: "Token is required." }));
  });

  it("malformed JSON → 400 VALIDATION_ERROR with empty fieldErrors", async () => {
    const response = await call("/google", { rawBody: "{" });
    expect(response.status).toBe(400);
    expect(response.body).toEqual(validationError({}));
  });

  it("with Google unconfigured → 401 INVALID_GOOGLE_TOKEN (D-08)", async () => {
    const unconfigured = await startTestApp({ googleTokenVerifier: new GoogleAuthLibraryTokenVerifier(null) });
    try {
      const response = await sendRequest(unconfigured.baseUrl, `${BASE}/google`, { body: { token: "anything" } });
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ code: "INVALID_GOOGLE_TOKEN", message: "Google sign-in failed." });
    } finally {
      await unconfigured.close();
    }
  });
});

describe("POST /refresh, GET /me, POST /logout (T-UA-08)", () => {
  it("/refresh with a valid cookie → 200 SessionPayload", async () => {
    const registered = await registerUser();
    const response = await call("/refresh", {
      method: "POST",
      cookie: `refresh_token=${readRefreshCookieValue(registered) ?? ""}`,
    });
    expect(response.status).toBe(200);
    expectSessionPayload(response, "jane@example.com");
  });

  it("/refresh without a cookie → 401 UNAUTHENTICATED", async () => {
    const response = await call("/refresh", { method: "POST" });
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ code: "UNAUTHENTICATED", message: "Authentication required." });
  });

  it("/me with a Bearer token → 200 { user }", async () => {
    const registered = await registerUser();
    const { accessToken, user } = registered.body as { accessToken: string; user: unknown };

    const response = await call("/me", { headers: { authorization: `Bearer ${accessToken}` } });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ user });
  });

  it("/me without a token → 401 UNAUTHENTICATED", async () => {
    const response = await call("/me");
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ code: "UNAUTHENTICATED", message: "Authentication required." });
  });

  it("/logout → 200 SuccessAck", async () => {
    const response = await call("/logout", { method: "POST" });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
  });
});

describe("POST /forgot-password (T-UA-08)", () => {
  it("registered and unregistered emails get byte-identical 200 bodies", async () => {
    await registerUser();

    const registered = await call("/forgot-password", { body: { email: "jane@example.com" } });
    const unregistered = await call("/forgot-password", { body: { email: "nobody@example.com" } });

    expect(registered.status).toBe(200);
    expect(unregistered.status).toBe(200);
    expect(registered.body).toEqual(FORGOT_ACK);
    expect(registered.text).toBe(unregistered.text);
    expect(app.mailer.messages).toHaveLength(1);
  });

  it.each([
    [{}, "Email is required."],
    [{ email: "   " }, "Email is required."],
    [{ email: "nope" }, "Enter a valid email address."],
  ])("400 for %j", async (body, message) => {
    const response = await call("/forgot-password", { body });
    expect(response.status).toBe(400);
    expect(response.body).toEqual(validationError({ email: message }));
  });

  it("malformed JSON → 400 VALIDATION_ERROR with empty fieldErrors", async () => {
    const response = await call("/forgot-password", { rawBody: "{'email':1}" });
    expect(response.status).toBe(400);
    expect(response.body).toEqual(validationError({}));
  });
});

describe("POST /reset-password (T-UA-08)", () => {
  async function requestResetToken(): Promise<string> {
    await registerUser();
    await call("/forgot-password", { body: { email: "jane@example.com" } });
    return app.mailer.lastToken();
  }

  it("200 SuccessAck with no cookie set or cleared", async () => {
    const token = await requestResetToken();

    const response = await call("/reset-password", {
      body: { token, password: "new-pass1!", confirmPassword: "new-pass1!" },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
    expect(response.setCookies).toEqual([]);
  });

  it("400 VALIDATION_ERROR with token, password and confirmPassword messages", async () => {
    const response = await call("/reset-password", { body: { token: "", password: "", confirmPassword: "" } });
    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      validationError({
        token: "Token is required.",
        password: "Password is required.",
        confirmPassword: "Please confirm your password.",
      })
    );
  });

  it("validates the body before looking up the token", async () => {
    const response = await call("/reset-password", {
      body: { token: "bogus", password: "weakpass", confirmPassword: "weakpass" },
    });
    expect(response.status).toBe(400);
    expect(response.body).toEqual(validationError({ password: "Password must include a number." }));
  });

  it("400 INVALID_RESET_TOKEN for a valid body with an unknown token", async () => {
    const response = await call("/reset-password", {
      body: { token: "bogus", password: "new-pass1!", confirmPassword: "new-pass1!" },
    });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: "INVALID_RESET_TOKEN",
      message: "This reset link is invalid or has expired.",
    });
  });

  it("malformed JSON → 400 VALIDATION_ERROR with empty fieldErrors", async () => {
    const response = await call("/reset-password", { rawBody: "[" });
    expect(response.status).toBe(400);
    expect(response.body).toEqual(validationError({}));
  });
});

describe("general error handling (T-UA-08)", () => {
  it("a forced unexpected error → 500 INTERNAL_ERROR with no stack", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failingMailer: Mailer = {
      sendPasswordResetLink: () => Promise.reject(new Error("SMTP exploded at secret-host:25")),
    };
    const failing = await startTestApp({ mailer: failingMailer });
    try {
      await sendRequest(failing.baseUrl, `${BASE}/signup`, { body: signUpBody("jane@example.com") });

      const response = await sendRequest(failing.baseUrl, `${BASE}/forgot-password`, {
        body: { email: "jane@example.com" },
      });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ code: "INTERNAL_ERROR", message: "An unexpected error occurred." });
      expect(response.text).not.toContain("SMTP");
      expect(response.text).not.toContain("at ");
      expect(consoleError).toHaveBeenCalled();
    } finally {
      await failing.close();
    }
  });

  it("a body over the 100 kB limit is an unexpected failure (500)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await call("/login", { body: { email: "a@b.co", password: "x".repeat(110 * 1024) } });
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ code: "INTERNAL_ERROR", message: "An unexpected error occurred." });
  });

  it.each([
    ["GET", "/api/v1/unknown"],
    ["GET", `${BASE}/login`],
    ["DELETE", `${BASE}/me`],
    ["GET", "/"],
  ])("an unknown route %s %s → 404 NOT_FOUND", async (method, path) => {
    const response = await sendRequest(app.baseUrl, path, { method });
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ code: "NOT_FOUND", message: "Route not found." });
  });
});
