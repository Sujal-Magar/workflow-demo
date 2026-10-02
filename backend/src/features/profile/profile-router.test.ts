import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  sendRequest,
  signUpBody,
  startTestApp,
  type JsonResponse,
  type RequestOptions,
  type TestApp,
} from "../../test-support/auth-test-harness";

const BASE = "/api/v1/profile";
const AUTH_BASE = "/api/v1/auth";

let app: TestApp;

beforeEach(async () => {
  app = await startTestApp();
});

afterEach(async () => {
  await app.close();
});

function call(path: string, options?: RequestOptions): Promise<JsonResponse> {
  return sendRequest(app.baseUrl, `${BASE}${path}`, options);
}

function validationError(fieldErrors: Record<string, string>) {
  return { code: "VALIDATION_ERROR", message: "Request validation failed.", fieldErrors };
}

async function registerAndGetToken(email = "jane@example.com"): Promise<{ accessToken: string; refreshToken: string }> {
  const response = await sendRequest(app.baseUrl, `${AUTH_BASE}/signup`, { body: signUpBody(email) });
  expect(response.status).toBe(201);
  const body = response.body as { accessToken: string };
  const setCookie = response.setCookies.find((cookie) => cookie.startsWith("refresh_token="));
  const refreshToken = setCookie?.slice("refresh_token=".length).split(";")[0] ?? "";
  return { accessToken: body.accessToken, refreshToken };
}

function authHeader(accessToken: string): Record<string, string> {
  return { authorization: `Bearer ${accessToken}` };
}

describe("every profile route requires auth (T-UA-09)", () => {
  it.each([
    ["GET", "/"],
    ["PATCH", "/"],
    ["POST", "/change-password"],
    ["GET", "/export"],
    ["POST", "/clear-data"],
  ])("%s %s with no token → 401 UNAUTHENTICATED", async (method, path) => {
    const response = await call(path, { method });
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ code: "UNAUTHENTICATED", message: "Authentication required." });
  });

  it.each([
    ["GET", "/"],
    ["PATCH", "/"],
    ["POST", "/change-password"],
    ["GET", "/export"],
    ["POST", "/clear-data"],
  ])("%s %s with an invalid token → 401 UNAUTHENTICATED", async (method, path) => {
    const response = await call(path, { method, headers: authHeader("not-a-real-token") });
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ code: "UNAUTHENTICATED", message: "Authentication required." });
  });

  it("GET / with an expired-looking (garbage) bearer token → 401 UNAUTHENTICATED", async () => {
    const response = await call("/", { headers: authHeader("a.b.c") });
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ code: "UNAUTHENTICATED", message: "Authentication required." });
  });
});

describe("GET /api/v1/profile (T-UA-09)", () => {
  it("200 with defaults on first call, reflects an update on a second call", async () => {
    const { accessToken } = await registerAndGetToken();

    const first = await call("/", { headers: authHeader(accessToken) });
    expect(first.status).toBe(200);
    const firstBody = first.body as Record<string, unknown>;
    expect(firstBody.avatarUrl).toBeNull();
    expect(firstBody.preferredCurrency).toBe("NPR");
    expect(firstBody.notificationPreferences).toEqual({
      budgetLimitAlerts: true,
      goalReminders: true,
      weeklySummaryEmails: true,
    });

    await call("/", {
      method: "PATCH",
      headers: authHeader(accessToken),
      body: { avatarUrl: "https://example.com/avatar.png" },
    });
    const second = await call("/", { headers: authHeader(accessToken) });
    expect((second.body as { avatarUrl: string }).avatarUrl).toBe("https://example.com/avatar.png");
  });
});

describe("PATCH /api/v1/profile (T-UA-09)", () => {
  it("200 with updated fields", async () => {
    const { accessToken } = await registerAndGetToken();

    const response = await call("/", {
      method: "PATCH",
      headers: authHeader(accessToken),
      body: { name: "New Name", notificationPreferences: { weeklySummaryEmails: false } },
    });

    expect(response.status).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body.name).toBe("New Name");
    expect(body.notificationPreferences).toEqual({
      budgetLimitAlerts: true,
      goalReminders: true,
      weeklySummaryEmails: false,
    });
  });

  it("400 VALIDATION_ERROR for a 1-character name", async () => {
    const { accessToken } = await registerAndGetToken();

    const response = await call("/", { method: "PATCH", headers: authHeader(accessToken), body: { name: "A" } });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(validationError({ name: "Name must be at least 2 characters." }));
  });

  it("400 VALIDATION_ERROR for a 101-character name", async () => {
    const { accessToken } = await registerAndGetToken();

    const response = await call("/", {
      method: "PATCH",
      headers: authHeader(accessToken),
      body: { name: "A".repeat(101) },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(validationError({ name: "Name must be at most 100 characters." }));
  });

  it("400 VALIDATION_ERROR for an explicit empty avatarUrl", async () => {
    const { accessToken } = await registerAndGetToken();

    const response = await call("/", { method: "PATCH", headers: authHeader(accessToken), body: { avatarUrl: "" } });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(validationError({ avatarUrl: "Avatar URL cannot be empty." }));
  });

  it("400 VALIDATION_ERROR when every field is absent", async () => {
    const { accessToken } = await registerAndGetToken();

    const response = await call("/", { method: "PATCH", headers: authHeader(accessToken), body: {} });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(validationError({}));
  });

  it("a request including preferredCurrency is ignored (D-05), response unchanged", async () => {
    const { accessToken } = await registerAndGetToken();
    const before = await call("/", { headers: authHeader(accessToken) });

    const response = await call("/", {
      method: "PATCH",
      headers: authHeader(accessToken),
      body: { name: "Same Fields", preferredCurrency: "USD", language: "fr", monthlyStartDate: 20 },
    });

    expect(response.status).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body.preferredCurrency).toBe((before.body as Record<string, unknown>).preferredCurrency);
    expect(body.language).toBe((before.body as Record<string, unknown>).language);
    expect(body.monthlyStartDate).toBe((before.body as Record<string, unknown>).monthlyStartDate);
  });
});

describe("POST /api/v1/profile/change-password (T-UA-09)", () => {
  async function activeAccessToken(): Promise<{ accessToken: string; refreshToken: string }> {
    return registerAndGetToken();
  }

  it("200 ProfileSuccessAck on a correct change, and invalidates a previously issued refresh token", async () => {
    const { accessToken, refreshToken } = await activeAccessToken();

    const response = await call("/change-password", {
      method: "POST",
      headers: authHeader(accessToken),
      body: { currentPassword: "abcdefg1!", newPassword: "zyxwvut9?", confirmPassword: "zyxwvut9?" },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, message: "Password updated successfully." });

    const refreshResponse = await sendRequest(app.baseUrl, `${AUTH_BASE}/refresh`, {
      method: "POST",
      cookie: `refresh_token=${refreshToken}`,
    });
    expect(refreshResponse.status).toBe(401);
  });

  it("400 VALIDATION_ERROR for an empty currentPassword/newPassword/confirmPassword", async () => {
    const { accessToken } = await activeAccessToken();

    const response = await call("/change-password", {
      method: "POST",
      headers: authHeader(accessToken),
      body: { currentPassword: "", newPassword: "", confirmPassword: "" },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      validationError({
        currentPassword: "Current password is required.",
        newPassword: "Password is required.",
        confirmPassword: "Please confirm your password.",
      })
    );
  });

  it("400 SAME_PASSWORD when newPassword equals currentPassword", async () => {
    const { accessToken } = await activeAccessToken();

    const response = await call("/change-password", {
      method: "POST",
      headers: authHeader(accessToken),
      body: { currentPassword: "abcdefg1!", newPassword: "abcdefg1!", confirmPassword: "abcdefg1!" },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: "SAME_PASSWORD",
      message: "New password must be different from your current password.",
    });
  });

  it("400 PASSWORDS_DO_NOT_MATCH when confirmPassword differs from newPassword", async () => {
    const { accessToken } = await activeAccessToken();

    const response = await call("/change-password", {
      method: "POST",
      headers: authHeader(accessToken),
      body: { currentPassword: "abcdefg1!", newPassword: "zyxwvut9?", confirmPassword: "different-pass2?" },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: "PASSWORDS_DO_NOT_MATCH",
      message: "New password and confirmation do not match.",
    });
  });

  it("401 INVALID_CREDENTIALS for a wrong currentPassword", async () => {
    const { accessToken } = await activeAccessToken();

    const response = await call("/change-password", {
      method: "POST",
      headers: authHeader(accessToken),
      body: { currentPassword: "wrong-pass1!", newPassword: "zyxwvut9?", confirmPassword: "zyxwvut9?" },
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ code: "INVALID_CREDENTIALS", message: "Invalid email or password." });
  });

  it("429 RATE_LIMIT_EXCEEDED after 5 failed attempts", async () => {
    const { accessToken } = await activeAccessToken();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failing = await call("/change-password", {
        method: "POST",
        headers: authHeader(accessToken),
        body: { currentPassword: "wrong-pass1!", newPassword: "zyxwvut9?", confirmPassword: "zyxwvut9?" },
      });
      expect(failing.status).toBe(401);
    }

    const response = await call("/change-password", {
      method: "POST",
      headers: authHeader(accessToken),
      body: { currentPassword: "abcdefg1!", newPassword: "zyxwvut9?", confirmPassword: "zyxwvut9?" },
    });

    expect(response.status).toBe(429);
    expect(response.body).toEqual({
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many password change attempts. Please try again later.",
    });
  });
});

describe("GET /api/v1/profile/export (T-UA-09)", () => {
  it("200 with Content-Disposition: attachment and a JSON body of exactly the D-01 field list", async () => {
    const { accessToken } = await registerAndGetToken();

    const response = await call("/export", { headers: authHeader(accessToken) });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(response.headers.get("content-disposition")).toMatch(/filename="profile-export-\d{4}-\d{2}-\d{2}\.json"/);
    expect(Object.keys(response.body as Record<string, unknown>).sort()).toEqual(
      [
        "avatarUrl",
        "createdAt",
        "email",
        "id",
        "language",
        "monthlyStartDate",
        "name",
        "notificationPreferences",
        "preferredCurrency",
        "updatedAt",
      ].sort()
    );
  });
});

describe("POST /api/v1/profile/clear-data (T-UA-09)", () => {
  it("200 with correct confirmation, and a follow-up GET shows reset values", async () => {
    const { accessToken } = await registerAndGetToken();
    await call("/", {
      method: "PATCH",
      headers: authHeader(accessToken),
      body: { avatarUrl: "https://example.com/before.png", notificationPreferences: { goalReminders: false } },
    });

    const response = await call("/clear-data", {
      method: "POST",
      headers: authHeader(accessToken),
      body: { confirmation: "DELETE" },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, message: "All profile data has been cleared." });

    const after = await call("/", { headers: authHeader(accessToken) });
    const body = after.body as Record<string, unknown>;
    expect(body.avatarUrl).toBeNull();
    expect(body.notificationPreferences).toEqual({
      budgetLimitAlerts: true,
      goalReminders: true,
      weeklySummaryEmails: true,
    });
  });

  it("400 VALIDATION_ERROR with a wrong confirmation", async () => {
    const { accessToken } = await registerAndGetToken();

    const response = await call("/clear-data", {
      method: "POST",
      headers: authHeader(accessToken),
      body: { confirmation: "delete" },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(validationError({ confirmation: "Type DELETE to confirm." }));
  });

  it("400 VALIDATION_ERROR with a missing confirmation", async () => {
    const { accessToken } = await registerAndGetToken();

    const response = await call("/clear-data", { method: "POST", headers: authHeader(accessToken), body: {} });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(validationError({ confirmation: "Type DELETE to confirm." }));
  });
});
