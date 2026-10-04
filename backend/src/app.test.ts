import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TEST_FRONTEND_ORIGIN, sendRequest, startTestApp, type TestApp } from "./test-support/auth-test-harness";

let app: TestApp;

beforeEach(async () => {
  app = await startTestApp();
});

afterEach(async () => {
  await app.close();
});

describe("CORS (T-UA-10, contract §8)", () => {
  it("a preflight from FRONTEND_ORIGIN → 204 with the exact origin, credentials and Authorization allowed", async () => {
    const response = await sendRequest(app.baseUrl, "/api/v1/auth/me", {
      method: "OPTIONS",
      headers: {
        origin: TEST_FRONTEND_ORIGIN,
        "access-control-request-method": "GET",
        "access-control-request-headers": "authorization",
      },
    });

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(response.headers.get("access-control-allow-origin")).toBe(TEST_FRONTEND_ORIGIN);
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
    expect(response.headers.get("access-control-allow-headers")).toContain("Authorization");
    expect(response.headers.get("access-control-allow-headers")).toContain("Content-Type");
    expect(response.headers.get("access-control-allow-methods")).toBe("GET, POST, PUT, PATCH, DELETE, OPTIONS");
    expect(response.headers.get("vary")).toContain("Origin");
  });

  it("uses a configured FRONTEND_ORIGIN, never *", async () => {
    const custom = await startTestApp({ env: { FRONTEND_ORIGIN: "http://app.example.test" } });
    try {
      const response = await sendRequest(custom.baseUrl, "/health", { headers: { origin: "http://app.example.test" } });
      expect(response.headers.get("access-control-allow-origin")).toBe("http://app.example.test");
    } finally {
      await custom.close();
    }
  });

  it("actual responses carry the CORS headers too", async () => {
    const response = await sendRequest(app.baseUrl, "/api/v1/auth/logout", {
      method: "POST",
      headers: { origin: TEST_FRONTEND_ORIGIN },
    });
    expect(response.headers.get("access-control-allow-origin")).toBe(TEST_FRONTEND_ORIGIN);
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  });
});

describe("regression: GET /health is unchanged (T-UA-10, plan §8.3)", () => {
  it("answers 200 with the original body", async () => {
    const response = await sendRequest(app.baseUrl, "/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", message: "ok" });
  });
});
