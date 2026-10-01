import { afterEach, describe, expect, it, vi } from "vitest";

import type { ClientEnv } from "./env";

/** `env.ts` reads `process.env` at import time, so each case imports a fresh copy. */
async function loadEnv(): Promise<ClientEnv> {
  vi.resetModules();
  return (await import("./env")).env;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("T-UI-20 · lib/env", () => {
  it("defaults the API base URL to http://localhost:4000 when unset (D-19)", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", undefined);

    expect((await loadEnv()).apiBaseUrl).toBe("http://localhost:4000");
  });

  it("defaults the API base URL when set to an empty value", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");

    expect((await loadEnv()).apiBaseUrl).toBe("http://localhost:4000");
  });

  it("uses NEXT_PUBLIC_API_BASE_URL when set", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.com");

    expect((await loadEnv()).apiBaseUrl).toBe("https://api.example.com");
  });

  it.each([
    ["unset", undefined],
    ["empty", ""],
  ])("has no Google client ID when NEXT_PUBLIC_GOOGLE_CLIENT_ID is %s (Google unavailable)", async (_label, value) => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", value);

    expect((await loadEnv()).googleClientId).toBeNull();
  });

  it("uses NEXT_PUBLIC_GOOGLE_CLIENT_ID when set", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "client-id.apps.googleusercontent.com");

    expect((await loadEnv()).googleClientId).toBe("client-id.apps.googleusercontent.com");
  });
});
