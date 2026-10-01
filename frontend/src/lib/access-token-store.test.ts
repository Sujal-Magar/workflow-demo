import { afterEach, describe, expect, it, vi } from "vitest";

import { clearAccessToken, getAccessToken, getAccessTokenExpiresAt, setAccessToken } from "./access-token-store";

afterEach(() => {
  vi.useRealTimers();
  clearAccessToken();
});

describe("T-UI-08 · in-memory access token store", () => {
  it("is empty until a token is set", () => {
    expect(getAccessToken()).toBeNull();
    expect(getAccessTokenExpiresAt()).toBeNull();
  });

  it("holds the token and its expiry computed from expiresIn", () => {
    vi.useFakeTimers({ now: new Date("2026-09-30T10:00:00Z") });

    setAccessToken("access-token-1", 900);

    expect(getAccessToken()).toBe("access-token-1");
    expect(getAccessTokenExpiresAt()).toBe(new Date("2026-09-30T10:15:00Z").getTime());
  });

  it("forgets the token and expiry when cleared", () => {
    setAccessToken("access-token-1", 900);

    clearAccessToken();

    expect(getAccessToken()).toBeNull();
    expect(getAccessTokenExpiresAt()).toBeNull();
  });
});
