import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { clearAccessToken, getAccessToken } from "@/lib/access-token-store";
import { resetNavigationMock, routerMock } from "@/test/navigation-mock";
import {
  createDeferred,
  createFakeAuth,
  createTestQueryClient,
  renderWithProviders,
  TEST_SESSION,
  TEST_USER,
} from "@/test/render-with-providers";

import { getCurrentUser, logout, refreshSession } from "../api/auth-api";
import { CURRENT_USER_QUERY_KEY } from "../hooks/use-current-user";
import { AuthProvider } from "../session/auth-provider";
import { useAuth } from "../session/use-auth";
import { DashboardPlaceholder } from "./dashboard-placeholder";

vi.mock("next/navigation", async () => (await import("@/test/navigation-mock")).nextNavigationMock);
vi.mock("@/features/auth/api/auth-api");

const getCurrentUserMock = vi.mocked(getCurrentUser);
const logoutMock = vi.mocked(logout);

afterEach(() => {
  resetNavigationMock();
  getCurrentUserMock.mockReset();
  logoutMock.mockReset();
  vi.mocked(refreshSession).mockReset();
  clearAccessToken();
});

describe("T-UI-11 · DashboardPlaceholder", () => {
  it("shows the session user's name at once and the Sign out button", () => {
    getCurrentUserMock.mockReturnValue(new Promise(() => undefined));
    renderWithProviders(<DashboardPlaceholder sessionUser={TEST_USER} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Signed in as Piyush Kumar");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
  });

  it("requests /me on mount despite the initial data and shows the returned name", async () => {
    getCurrentUserMock.mockResolvedValue({ ok: true, data: { user: { ...TEST_USER, name: "Piyush K." } } });
    renderWithProviders(<DashboardPlaceholder sessionUser={TEST_USER} />);

    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Signed in as Piyush K."));
    expect(getCurrentUserMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the session user's name when /me fails, without retrying", async () => {
    getCurrentUserMock.mockResolvedValue({ ok: false, failure: { kind: "unauthenticated" } });
    const { queryClient } = renderWithProviders(<DashboardPlaceholder sessionUser={TEST_USER} />);

    await waitFor(() => expect(queryClient.getQueryState(CURRENT_USER_QUERY_KEY)?.status).toBe("error"));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Signed in as Piyush Kumar");
    expect(getCurrentUserMock).toHaveBeenCalledTimes(1);
  });

  it("disables Sign out while the logout is pending", async () => {
    getCurrentUserMock.mockReturnValue(new Promise(() => undefined));
    const deferred = createDeferred<void>();
    const auth = createFakeAuth({ status: "authenticated", user: TEST_USER, logout: vi.fn(() => deferred.promise) });
    renderWithProviders(<DashboardPlaceholder sessionUser={TEST_USER} />, { auth });

    const button = screen.getByRole("button", { name: "Sign out" });
    fireEvent.click(button);

    expect(auth.logout).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(button).toBeDisabled());
    deferred.resolve();
    await waitFor(() => expect(button).toBeEnabled());
  });
});

describe("T-UI-11 · logout", () => {
  function StatusProbe() {
    return <p data-testid="auth-status">{useAuth().status}</p>;
  }

  async function renderSignedIn() {
    vi.mocked(refreshSession).mockResolvedValue({ ok: true, data: TEST_SESSION });
    getCurrentUserMock.mockReturnValue(new Promise(() => undefined));
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["transactions"], ["cached"]);
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <StatusProbe />
            <DashboardPlaceholder sessionUser={TEST_USER} />
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getByTestId("auth-status")).toHaveTextContent(/^authenticated$/));
    expect(getAccessToken()).toBe(TEST_SESSION.accessToken);
    return queryClient;
  }

  it("calls the logout API, clears the token and the query cache, then replaces the route with /auth", async () => {
    logoutMock.mockResolvedValue({ ok: true, data: { success: true } });
    const queryClient = await renderSignedIn();

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/auth"));
    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
    expect(queryClient.getQueryData(["transactions"])).toBeUndefined();
    expect(screen.getByTestId("auth-status")).toHaveTextContent(/^unauthenticated$/);
  });

  it("still clears the session and redirects when the logout API fails", async () => {
    logoutMock.mockResolvedValue({ ok: false, failure: { kind: "unexpected" } });
    const queryClient = await renderSignedIn();

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/auth"));
    expect(getAccessToken()).toBeNull();
    expect(queryClient.getQueryData(["transactions"])).toBeUndefined();
    expect(screen.getByTestId("auth-status")).toHaveTextContent(/^unauthenticated$/);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
