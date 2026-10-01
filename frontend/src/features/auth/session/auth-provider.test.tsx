import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionPayload } from "@workflow-demo/contracts";

import { ToastProvider } from "@/components/ui/toast";
import { clearAccessToken, getAccessToken } from "@/lib/access-token-store";
import { registerSessionHandlers, type SessionHandlers } from "@/lib/api-client";
import { resetNavigationMock, routerMock } from "@/test/navigation-mock";
import { createDeferred, createTestQueryClient, TEST_SESSION, TEST_USER } from "@/test/render-with-providers";

import { refreshSession } from "../api/auth-api";
import type { AuthResult } from "../lib/auth-error";
import { AuthProvider, renewalDelayMs, RENEWAL_LEAD_SECONDS } from "./auth-provider";
import { refreshSessionOnce } from "./session-refresh";
import { useAuth, type AuthContextValue } from "./use-auth";

vi.mock("next/navigation", async () => (await import("@/test/navigation-mock")).nextNavigationMock);
vi.mock("@/features/auth/api/auth-api");
vi.mock("@/lib/api-client", () => ({ registerSessionHandlers: vi.fn() }));

const refreshSessionMock = vi.mocked(refreshSession);
const registerSessionHandlersMock = vi.mocked(registerSessionHandlers);
// A fresh spy per test: the global cleanup unmounts the previous test's tree after this file's afterEach runs.
let unregisterMock = vi.fn();

const UNAUTHENTICATED: AuthResult<SessionPayload> = { ok: false, failure: { kind: "unauthenticated" } };
const UNEXPECTED: AuthResult<SessionPayload> = { ok: false, failure: { kind: "unexpected" } };
const RENEWED_SESSION: SessionPayload = { ...TEST_SESSION, accessToken: "access-token-2" };

let latestAuth: AuthContextValue | null = null;

function AuthProbe() {
  latestAuth = useAuth();
  return <p data-testid="auth-status">{latestAuth.status}</p>;
}

function currentAuth(): AuthContextValue {
  if (!latestAuth) {
    throw new Error("AuthProvider has not rendered yet");
  }
  return latestAuth;
}

function renderProvider(queryClient: QueryClient = createTestQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

async function expectStatus(status: string): Promise<void> {
  await waitFor(() => expect(screen.getByTestId("auth-status")).toHaveTextContent(new RegExp(`^${status}$`)));
}

beforeEach(() => {
  unregisterMock = vi.fn();
  registerSessionHandlersMock.mockReturnValue(unregisterMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetNavigationMock();
  refreshSessionMock.mockReset();
  registerSessionHandlersMock.mockReset();
  clearAccessToken();
  latestAuth = null;
});

describe("T-UI-08 · AuthProvider session restore", () => {
  it("starts loading, then restores an authenticated session with the token in memory", async () => {
    const deferred = createDeferred<AuthResult<SessionPayload>>();
    refreshSessionMock.mockReturnValue(deferred.promise);
    renderProvider();

    expect(screen.getByTestId("auth-status")).toHaveTextContent("loading");
    deferred.resolve({ ok: true, data: TEST_SESSION });

    await expectStatus("authenticated");
    expect(currentAuth().user).toEqual(TEST_USER);
    expect(getAccessToken()).toBe(TEST_SESSION.accessToken);
  });

  it("becomes unauthenticated on 401 without redirecting", async () => {
    refreshSessionMock.mockResolvedValue(UNAUTHENTICATED);
    renderProvider();

    await expectStatus("unauthenticated");
    expect(getAccessToken()).toBeNull();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("becomes unauthenticated on a network failure or 500 with no toast", async () => {
    refreshSessionMock.mockResolvedValue(UNEXPECTED);
    renderProvider();

    await expectStatus("unauthenticated");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("keeps a session established while the restore was pending when the restore then fails", async () => {
    const deferred = createDeferred<AuthResult<SessionPayload>>();
    refreshSessionMock.mockReturnValue(deferred.promise);
    renderProvider();

    act(() => currentAuth().establishSession(TEST_SESSION));
    await expectStatus("authenticated");
    await act(async () => deferred.resolve(UNAUTHENTICATED));

    expect(currentAuth().status).toBe("authenticated");
    expect(getAccessToken()).toBe(TEST_SESSION.accessToken);
  });

  it("ignores a restore failure that settles after unmount", async () => {
    const deferred = createDeferred<AuthResult<SessionPayload>>();
    refreshSessionMock.mockReturnValue(deferred.promise);
    const consoleErrorSpy = vi.spyOn(console, "error");
    const { unmount } = renderProvider();

    unmount();
    await act(async () => deferred.resolve(UNAUTHENTICATED));

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("never writes the access token to localStorage or sessionStorage", async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    refreshSessionMock.mockResolvedValue({ ok: true, data: TEST_SESSION });
    renderProvider();

    await expectStatus("authenticated");
    act(() => currentAuth().establishSession(RENEWED_SESSION));

    const writtenValues = setItemSpy.mock.calls.map(([, value]) => value);
    expect(writtenValues.some((value) => value.includes(TEST_SESSION.accessToken))).toBe(false);
    expect(writtenValues.some((value) => value.includes(RENEWED_SESSION.accessToken))).toBe(false);
    expect(window.localStorage).toHaveLength(0);
    expect(window.sessionStorage).toHaveLength(0);
  });
});

describe("T-UI-08 · single-flight refresh", () => {
  it("shares one request between concurrent refreshes", async () => {
    const deferred = createDeferred<AuthResult<SessionPayload>>();
    refreshSessionMock.mockReturnValue(deferred.promise);
    renderProvider();

    let results: boolean[] = [];
    const pending = Promise.all([currentAuth().refreshSession(), currentAuth().refreshSession()]).then((values) => {
      results = values;
    });
    expect(refreshSessionMock).toHaveBeenCalledTimes(1);

    deferred.resolve({ ok: true, data: TEST_SESSION });
    await act(async () => {
      await pending;
    });

    expect(results).toEqual([true, true]);
    expect(refreshSessionMock).toHaveBeenCalledTimes(1);
  });

  it("starts a new request once the previous one has settled", async () => {
    refreshSessionMock.mockResolvedValue(UNAUTHENTICATED);

    await Promise.all([refreshSessionOnce(), refreshSessionOnce()]);
    await refreshSessionOnce();

    expect(refreshSessionMock).toHaveBeenCalledTimes(2);
  });
});

describe("T-UI-08 · renewal", () => {
  it("computes the renewal delay as expiresIn − 60 s, never negative", () => {
    expect(RENEWAL_LEAD_SECONDS).toBe(60);
    expect(renewalDelayMs(900)).toBe(840_000);
    expect(renewalDelayMs(30)).toBe(0);
  });

  it("renews the session at expiresIn − 60 s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    refreshSessionMock.mockResolvedValueOnce({ ok: true, data: TEST_SESSION });
    refreshSessionMock.mockResolvedValueOnce({ ok: true, data: RENEWED_SESSION });
    renderProvider();
    await expectStatus("authenticated");
    expect(refreshSessionMock).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(renewalDelayMs(TEST_SESSION.expiresIn) - 1_000));
    expect(refreshSessionMock).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(refreshSessionMock).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(getAccessToken()).toBe(RENEWED_SESSION.accessToken));
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("clears the session and redirects to /auth when renewal fails", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["cached"], "value");
    refreshSessionMock.mockResolvedValueOnce({ ok: true, data: TEST_SESSION });
    refreshSessionMock.mockResolvedValueOnce(UNAUTHENTICATED);
    renderProvider(queryClient);
    await expectStatus("authenticated");

    await act(() => vi.advanceTimersByTimeAsync(renewalDelayMs(TEST_SESSION.expiresIn)));

    await expectStatus("unauthenticated");
    expect(routerMock.replace).toHaveBeenCalledWith("/auth");
    expect(getAccessToken()).toBeNull();
    expect(queryClient.getQueryData(["cached"])).toBeUndefined();
  });

  it("cancels the renewal timer when the session is cleared", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    refreshSessionMock.mockResolvedValue({ ok: true, data: TEST_SESSION });
    renderProvider();
    await expectStatus("authenticated");

    act(() => currentAuth().clearSession());
    await act(() => vi.advanceTimersByTimeAsync(renewalDelayMs(TEST_SESSION.expiresIn) * 2));

    expect(refreshSessionMock).toHaveBeenCalledTimes(1);
    expect(currentAuth().status).toBe("unauthenticated");
  });
});

describe("T-UI-08 · session handler registration (D-23)", () => {
  function registeredHandlers(): SessionHandlers {
    const handlers = registerSessionHandlersMock.mock.calls[0]?.[0];
    if (!handlers) {
      throw new Error("registerSessionHandlers was not called");
    }
    return handlers;
  }

  it("registers once on mount with its own refreshSession and expireSession, and unregisters on unmount", async () => {
    refreshSessionMock.mockResolvedValue(UNAUTHENTICATED);
    const { unmount } = renderProvider();
    await expectStatus("unauthenticated");

    expect(registerSessionHandlersMock).toHaveBeenCalledTimes(1);
    expect(registeredHandlers().refreshSession).toBe(currentAuth().refreshSession);
    expect(registeredHandlers().onSessionExpired).toBe(currentAuth().expireSession);
    expect(unregisterMock).not.toHaveBeenCalled();

    unmount();

    expect(unregisterMock).toHaveBeenCalledTimes(1);
  });

  it("has the registered refreshSession resolve true and establish the session on success", async () => {
    refreshSessionMock.mockResolvedValueOnce(UNAUTHENTICATED);
    refreshSessionMock.mockResolvedValueOnce({ ok: true, data: RENEWED_SESSION });
    renderProvider();
    await expectStatus("unauthenticated");

    let isRefreshed = false;
    await act(async () => {
      isRefreshed = await registeredHandlers().refreshSession();
    });

    expect(isRefreshed).toBe(true);
    await expectStatus("authenticated");
    expect(getAccessToken()).toBe(RENEWED_SESSION.accessToken);
  });

  it("has the registered refreshSession resolve false on failure without clearing the session", async () => {
    refreshSessionMock.mockResolvedValueOnce({ ok: true, data: TEST_SESSION });
    refreshSessionMock.mockResolvedValueOnce(UNAUTHENTICATED);
    renderProvider();
    await expectStatus("authenticated");

    let isRefreshed = true;
    await act(async () => {
      isRefreshed = await registeredHandlers().refreshSession();
    });

    expect(isRefreshed).toBe(false);
    expect(currentAuth().status).toBe("authenticated");
    expect(getAccessToken()).toBe(TEST_SESSION.accessToken);
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("has the registered expireSession clear the session and replace the route with /auth", async () => {
    refreshSessionMock.mockResolvedValue({ ok: true, data: TEST_SESSION });
    renderProvider();
    await expectStatus("authenticated");

    act(() => registeredHandlers().onSessionExpired());

    await expectStatus("unauthenticated");
    expect(getAccessToken()).toBeNull();
    expect(routerMock.replace).toHaveBeenCalledWith("/auth");
  });
});

describe("useAuth", () => {
  it("throws outside AuthProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<AuthProbe />)).toThrow("useAuth must be used inside <AuthProvider>.");
  });
});
