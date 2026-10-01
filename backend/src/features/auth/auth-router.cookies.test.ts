import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  OTHER_STRONG_PASSWORD,
  STRONG_PASSWORD,
  readRefreshCookieValue,
  refreshCookieHeader,
  sendRequest,
  signUpBody,
  startTestApp,
  type JsonResponse,
  type RequestOptions,
  type TestApp,
} from "../../test-support/auth-test-harness";

const BASE = "/api/v1/auth";
const THIRTY_MINUTES_MS = 30 * 60_000;

let app: TestApp;

afterEach(async () => {
  await app.close();
});

function call(path: string, options?: RequestOptions): Promise<JsonResponse> {
  return sendRequest(app.baseUrl, `${BASE}${path}`, options);
}

interface ParsedCookie {
  readonly value: string;
  readonly attributes: ReadonlyMap<string, string>;
}

function parseRefreshCookie(response: JsonResponse): ParsedCookie {
  const header = response.setCookies.find((cookie) => cookie.startsWith("refresh_token="));
  if (header === undefined) {
    throw new Error(`No refresh_token cookie in: ${JSON.stringify(response.setCookies)}`);
  }
  const [pair = "", ...rawAttributes] = header.split(";").map((part) => part.trim());
  const attributes = new Map<string, string>();
  for (const attribute of rawAttributes) {
    const [name = "", value = ""] = attribute.split("=");
    attributes.set(name.toLowerCase(), value);
  }
  return { value: pair.slice("refresh_token=".length), attributes };
}

function expectSetCookie(response: JsonResponse, { secure }: { secure: boolean }): void {
  const cookie = parseRefreshCookie(response);
  expect(cookie.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(cookie.attributes.get("max-age")).toBe("604800");
  expect(cookie.attributes.get("path")).toBe("/api/v1/auth");
  expect(cookie.attributes.has("httponly")).toBe(true);
  expect(cookie.attributes.get("samesite")).toBe("Lax");
  expect(cookie.attributes.has("secure")).toBe(secure);
  expect(cookie.attributes.has("domain")).toBe(false);
}

function expectClearedCookie(response: JsonResponse, { secure }: { secure: boolean } = { secure: false }): void {
  const cookie = parseRefreshCookie(response);
  expect(cookie.value).toBe("");
  expect(cookie.attributes.get("max-age")).toBe("0");
  expect(cookie.attributes.get("path")).toBe("/api/v1/auth");
  expect(cookie.attributes.has("httponly")).toBe(true);
  expect(cookie.attributes.get("samesite")).toBe("Lax");
  expect(cookie.attributes.has("secure")).toBe(secure);
}

async function signUp(email = "jane@example.com"): Promise<string> {
  const response = await call("/signup", { body: signUpBody(email) });
  expect(response.status).toBe(201);
  return readRefreshCookieValue(response) ?? "";
}

function refresh(cookieValue?: string): Promise<JsonResponse> {
  return call("/refresh", {
    method: "POST",
    cookie: cookieValue === undefined ? undefined : refreshCookieHeader(cookieValue),
  });
}

describe("Set-Cookie attributes (T-UA-09, contract §4)", () => {
  beforeEach(async () => {
    app = await startTestApp();
  });

  it("register, login and google set the cookie without Secure outside production", async () => {
    const register = await call("/signup", { body: signUpBody("jane@example.com") });
    const login = await call("/login", { body: { email: "jane@example.com", password: STRONG_PASSWORD } });
    app.googleVerifier.register("g-token", { googleId: "g-1", email: "jane@example.com" });
    const google = await call("/google", { body: { token: "g-token" } });

    for (const response of [register, login, google]) {
      expectSetCookie(response, { secure: false });
    }
  });
});

describe("Set-Cookie in production (T-UA-09)", () => {
  beforeEach(async () => {
    app = await startTestApp({ env: { NODE_ENV: "production", GOOGLE_CLIENT_ID: "client-id" } });
  });

  it("adds Secure when set and when cleared", async () => {
    const register = await call("/signup", { body: signUpBody("jane@example.com") });
    expectSetCookie(register, { secure: true });

    const refreshed = await refresh(readRefreshCookieValue(register) ?? "");
    expectSetCookie(refreshed, { secure: true });

    const logout = await call("/logout", { method: "POST" });
    expectClearedCookie(logout, { secure: true });
  });
});

describe("refresh, logout and reset flows (T-UA-09)", () => {
  beforeEach(async () => {
    app = await startTestApp();
  });

  it("refresh with a cookie → 200 and a different cookie value", async () => {
    const original = await signUp();

    const response = await refresh(original);

    expect(response.status).toBe(200);
    expectSetCookie(response, { secure: false });
    expect(readRefreshCookieValue(response)).not.toBe(original);
  });

  it("replaying the old cookie → 401 and the cookie cleared", async () => {
    const original = await signUp();
    await refresh(original);

    const replay = await refresh(original);

    expect(replay.status).toBe(401);
    expect(replay.body).toEqual({ code: "UNAUTHENTICATED", message: "Authentication required." });
    expectClearedCookie(replay);
  });

  it("no cookie → 401 and the cookie cleared", async () => {
    const response = await refresh();
    expect(response.status).toBe(401);
    expectClearedCookie(response);
  });

  it("an expired cookie (clock + 7 d) → 401 and cleared", async () => {
    const original = await signUp();
    app.clock.advanceBy(604_800_000);

    const response = await refresh(original);

    expect(response.status).toBe(401);
    expectClearedCookie(response);
  });

  it("logout → 200 and cleared, then /refresh with the old cookie → 401", async () => {
    const original = await signUp();

    const logout = await call("/logout", { method: "POST", cookie: refreshCookieHeader(original) });
    expect(logout.status).toBe(200);
    expect(logout.body).toEqual({ success: true });
    expectClearedCookie(logout);

    const response = await refresh(original);
    expect(response.status).toBe(401);
  });

  it("logout without a cookie → 200 and cleared", async () => {
    const logout = await call("/logout", { method: "POST" });
    expect(logout.status).toBe(200);
    expect(logout.body).toEqual({ success: true });
    expectClearedCookie(logout);
  });

  it("logout with an unknown cookie → 200 and cleared", async () => {
    const logout = await call("/logout", { method: "POST", cookie: refreshCookieHeader("unknown-value") });
    expect(logout.status).toBe(200);
    expectClearedCookie(logout);
  });

  it("after a reset, every earlier refresh cookie → 401; the new password logs in and the old one fails", async () => {
    const first = await signUp();
    const second = readRefreshCookieValue(
      await call("/login", { body: { email: "jane@example.com", password: STRONG_PASSWORD } })
    );
    await call("/forgot-password", { body: { email: "jane@example.com" } });

    const reset = await call("/reset-password", {
      body: { token: app.mailer.lastToken(), password: OTHER_STRONG_PASSWORD, confirmPassword: OTHER_STRONG_PASSWORD },
    });
    expect(reset.status).toBe(200);
    expect(reset.setCookies).toEqual([]);

    for (const cookie of [first, second ?? ""]) {
      const response = await refresh(cookie);
      expect(response.status).toBe(401);
      expectClearedCookie(response);
    }
    const oldLogin = await call("/login", { body: { email: "jane@example.com", password: STRONG_PASSWORD } });
    expect(oldLogin.status).toBe(401);
    const newLogin = await call("/login", { body: { email: "jane@example.com", password: OTHER_STRONG_PASSWORD } });
    expect(newLogin.status).toBe(200);
  });

  it("a reset token after the clock advances 30 minutes → 400 INVALID_RESET_TOKEN", async () => {
    await signUp();
    await call("/forgot-password", { body: { email: "jane@example.com" } });
    app.clock.advanceBy(THIRTY_MINUTES_MS);

    const response = await call("/reset-password", {
      body: { token: app.mailer.lastToken(), password: OTHER_STRONG_PASSWORD, confirmPassword: OTHER_STRONG_PASSWORD },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: "INVALID_RESET_TOKEN",
      message: "This reset link is invalid or has expired.",
    });
  });

  it("a reused reset token → 400 INVALID_RESET_TOKEN", async () => {
    await signUp();
    await call("/forgot-password", { body: { email: "jane@example.com" } });
    const body = {
      token: app.mailer.lastToken(),
      password: OTHER_STRONG_PASSWORD,
      confirmPassword: OTHER_STRONG_PASSWORD,
    };
    expect((await call("/reset-password", { body })).status).toBe(200);

    const reuse = await call("/reset-password", { body });

    expect(reuse.status).toBe(400);
    expect((reuse.body as { code: string }).code).toBe("INVALID_RESET_TOKEN");
  });
});
