import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearAccessToken, setAccessToken } from "./access-token-store";
import { authApiClient, registerSessionHandlers, type SessionHandlers } from "./api-client";

const UNAUTHENTICATED_BODY = { code: "UNAUTHENTICATED", message: "Authentication required." };
const USER = { id: "3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b", name: "Piyush Kumar", email: "piyush@example.com" };
const SESSION = { user: USER, accessToken: "access-token-1", expiresIn: 900 };
const SIGN_UP_BODY = {
  name: "Piyush Kumar",
  email: "piyush@example.com",
  password: "Passw0rd!",
  confirmPassword: "Passw0rd!",
};

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
let unregisterHandlers: () => void = () => undefined;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function requestAt(index: number): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls[index];
  if (!call) {
    throw new Error(`No fetch call at index ${index}`);
  }
  return { url: String(call[0]), init: call[1] ?? {} };
}

function authorizationHeaderAt(index: number): string | null {
  return new Headers(requestAt(index).init.headers).get("authorization");
}

function createHandlers(isRefreshed: boolean, tokenAfterRefresh = "access-token-2") {
  const refreshSession = vi.fn(async () => {
    if (isRefreshed) {
      setAccessToken(tokenAfterRefresh, 900);
    }
    return isRefreshed;
  });
  const onSessionExpired = vi.fn();
  const handlers: SessionHandlers = { refreshSession, onSessionExpired };
  return { handlers, refreshSession, onSessionExpired };
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  unregisterHandlers();
  unregisterHandlers = () => undefined;
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  clearAccessToken();
});

/** The seven public and cookie operations (contract §7), each invoked with a valid request. */
const UNRETRIED_OPERATIONS: ReadonlyArray<readonly [string, () => Promise<unknown>]> = [
  ["register", () => authApiClient.register.mutate({ body: SIGN_UP_BODY })],
  ["login", () => authApiClient.login.mutate({ body: { email: USER.email, password: "Passw0rd!" } })],
  ["googleOAuthLogin", () => authApiClient.googleOAuthLogin.mutate({ body: { token: "google-token" } })],
  ["refreshSession", () => authApiClient.refreshSession.mutate()],
  ["logout", () => authApiClient.logout.mutate()],
  ["requestPasswordReset", () => authApiClient.requestPasswordReset.mutate({ body: { email: USER.email } })],
  [
    "resetPassword",
    () =>
      authApiClient.resetPassword.mutate({
        body: { token: "reset-token", password: "Passw0rd!", confirmPassword: "Passw0rd!" },
      }),
  ],
];

describe("T-UI-09 · auth-aware API fetcher", () => {
  it("includes credentials on every request and targets the API origin plus the contract path", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, SESSION));

    await authApiClient.refreshSession.mutate();

    const { url, init } = requestAt(0);
    expect(url).toBe("http://localhost:4000/api/v1/auth/refresh");
    expect(init.credentials).toBe("include");
    expect(authorizationHeaderAt(0)).toBeNull();
  });

  it("attaches the Bearer header when the token store holds a token", async () => {
    setAccessToken("stored-token", 900);
    fetchMock.mockResolvedValue(jsonResponse(200, { user: USER }));

    const response = await authApiClient.getCurrentUser.query();

    expect(response.status).toBe(200);
    expect(authorizationHeaderAt(0)).toBe("Bearer stored-token");
    expect(requestAt(0).init.credentials).toBe("include");
  });

  it("refreshes once and retries once with the new token after a protected 401 UNAUTHENTICATED", async () => {
    setAccessToken("expired-token", 900);
    const { handlers, refreshSession, onSessionExpired } = createHandlers(true);
    unregisterHandlers = registerSessionHandlers(handlers);
    fetchMock.mockResolvedValueOnce(jsonResponse(401, UNAUTHENTICATED_BODY));
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { user: USER }));

    const response = await authApiClient.getCurrentUser.query();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ user: USER });
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(onSessionExpired).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(authorizationHeaderAt(0)).toBe("Bearer expired-token");
    expect(authorizationHeaderAt(1)).toBe("Bearer access-token-2");
    expect(requestAt(1).init.credentials).toBe("include");
  });

  it("expires the session and returns the original 401 without retrying when the refresh fails", async () => {
    const { handlers, refreshSession, onSessionExpired } = createHandlers(false);
    unregisterHandlers = registerSessionHandlers(handlers);
    fetchMock.mockResolvedValueOnce(jsonResponse(401, UNAUTHENTICATED_BODY));

    const response = await authApiClient.getCurrentUser.query();

    expect(response.status).toBe(401);
    expect(response.body).toEqual(UNAUTHENTICATED_BODY);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("expires the session once and returns the 401 when the retry is also a 401, with no second refresh", async () => {
    const { handlers, refreshSession, onSessionExpired } = createHandlers(true);
    unregisterHandlers = registerSessionHandlers(handlers);
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(401, UNAUTHENTICATED_BODY)));

    const response = await authApiClient.getCurrentUser.query();

    expect(response.status).toBe(401);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not refresh on a protected 401 with a code other than UNAUTHENTICATED, or on another status", async () => {
    const { handlers, refreshSession, onSessionExpired } = createHandlers(true);
    unregisterHandlers = registerSessionHandlers(handlers);
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { code: "INVALID_CREDENTIALS", message: "x" }));
    fetchMock.mockResolvedValueOnce(jsonResponse(401, "not an error body"));
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { code: "INTERNAL_ERROR", message: "x" }));

    expect((await authApiClient.getCurrentUser.query()).status).toBe(401);
    expect((await authApiClient.getCurrentUser.query()).status).toBe(401);
    expect((await authApiClient.getCurrentUser.query()).status).toBe(500);

    expect(refreshSession).not.toHaveBeenCalled();
    expect(onSessionExpired).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("returns the 401 unchanged, with no refresh, when no handlers are registered", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, UNAUTHENTICATED_BODY));

    const response = await authApiClient.getCurrentUser.query();

    expect(response.status).toBe(401);
    expect(response.body).toEqual(UNAUTHENTICATED_BODY);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns the 401 unchanged after the handlers are unregistered", async () => {
    const { handlers, refreshSession, onSessionExpired } = createHandlers(true);
    const unregister = registerSessionHandlers(handlers);
    unregister();
    fetchMock.mockResolvedValueOnce(jsonResponse(401, UNAUTHENTICATED_BODY));

    const response = await authApiClient.getCurrentUser.query();

    expect(response.status).toBe(401);
    expect(refreshSession).not.toHaveBeenCalled();
    expect(onSessionExpired).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps newer handlers when a stale unregister function runs", async () => {
    const stale = createHandlers(true);
    const current = createHandlers(true);
    const unregisterStale = registerSessionHandlers(stale.handlers);
    unregisterHandlers = registerSessionHandlers(current.handlers);
    unregisterStale();
    fetchMock.mockResolvedValueOnce(jsonResponse(401, UNAUTHENTICATED_BODY));
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { user: USER }));

    await authApiClient.getCurrentUser.query();

    expect(stale.refreshSession).not.toHaveBeenCalled();
    expect(current.refreshSession).toHaveBeenCalledTimes(1);
  });

  it.each(UNRETRIED_OPERATIONS)("never retries %s, and a 401 on it never calls either handler", async (_name, send) => {
    const { handlers, refreshSession, onSessionExpired } = createHandlers(true);
    unregisterHandlers = registerSessionHandlers(handlers);
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(401, UNAUTHENTICATED_BODY)));

    const response = (await send()) as { status: number };

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestAt(0).init.credentials).toBe("include");
    expect(refreshSession).not.toHaveBeenCalled();
    expect(onSessionExpired).not.toHaveBeenCalled();
  });
});
