import { act, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getCurrentUser, resetPassword } from "@/features/auth/api/auth-api";
import type { AuthStatus } from "@/features/auth/session/use-auth";
import { resetNavigationMock, routerMock, setSearchParams, suspendSearchParams } from "@/test/navigation-mock";
import { createFakeAuth, renderWithProviders, TEST_USER } from "@/test/render-with-providers";

import DashboardPage from "./(protected)/dashboard/page";
import ProtectedLayout from "./(protected)/layout";
import AuthPage from "./auth/page";
import RootPage from "./page";
import ResetPasswordPage from "./reset-password/page";

vi.mock("next/navigation", async () => (await import("@/test/navigation-mock")).nextNavigationMock);
vi.mock("@react-oauth/google", async () => (await import("@/test/google-oauth-mock")).googleOAuthMock);
vi.mock("@/features/auth/api/auth-api");

afterEach(() => {
  resetNavigationMock();
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(resetPassword).mockReset();
});

function authWith(status: AuthStatus) {
  return createFakeAuth({ status, user: status === "authenticated" ? TEST_USER : null });
}

function expectLoader(): void {
  expect(screen.getByRole("status")).toHaveTextContent("Loading…");
}

describe("T-UI-10 / T-UI-20 · app/page (root route)", () => {
  it("shows the loader without redirecting while the session restores", () => {
    renderWithProviders(<RootPage />, { auth: authWith("loading") });

    expectLoader();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it.each([
    ["authenticated", "/dashboard"],
    ["unauthenticated", "/auth"],
  ] as const)("redirects to the right route when %s", (status, route) => {
    renderWithProviders(<RootPage />, { auth: authWith(status) });

    expectLoader();
    expect(routerMock.replace).toHaveBeenCalledWith(route);
    expect(routerMock.replace).toHaveBeenCalledTimes(1);
  });
});

describe("T-UI-20 · app/auth/page", () => {
  it("shows the full-page loader as the Suspense fallback, then the auth card in the mode from the query", async () => {
    setSearchParams("mode=signup");
    const release = suspendSearchParams();
    renderWithProviders(<AuthPage />, { auth: authWith("unauthenticated") });

    expectLoader();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();

    await act(async () => release());

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Create Account");
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });

  it("shows the sign-in card by default", () => {
    renderWithProviders(<AuthPage />, { auth: authWith("unauthenticated") });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Sign in to FinTrack");
  });

  it("redirects a signed-in visitor to /dashboard", () => {
    renderWithProviders(<AuthPage />, { auth: authWith("authenticated") });

    expect(routerMock.replace).toHaveBeenCalledWith("/dashboard");
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });
});

describe("T-UI-20 · app/reset-password/page", () => {
  it("shows the Suspense fallback, then the reset form for the token in the query", async () => {
    setSearchParams("token=abc123");
    const release = suspendSearchParams();
    renderWithProviders(<ResetPasswordPage />);

    expectLoader();
    await act(async () => release());

    expect(await screen.findByLabelText("New Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm New Password")).toBeInTheDocument();
  });

  it("shows the invalid-link state and sends no request when the token is missing", () => {
    renderWithProviders(<ResetPasswordPage />);

    expect(screen.getByText("This reset link is invalid or has expired.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "BACK TO SIGN IN" })).toHaveAttribute("href", "/auth");
    expect(resetPassword).not.toHaveBeenCalled();
  });
});

describe("T-UI-20 · app/(protected)/layout", () => {
  it("redirects an unauthenticated visitor to /auth without rendering the page", () => {
    renderWithProviders(<ProtectedLayout>dashboard content</ProtectedLayout>, { auth: authWith("unauthenticated") });

    expect(routerMock.replace).toHaveBeenCalledWith("/auth");
    expect(screen.queryByText("dashboard content")).not.toBeInTheDocument();
  });

  it("renders its children for an authenticated visitor", () => {
    renderWithProviders(<ProtectedLayout>dashboard content</ProtectedLayout>, { auth: authWith("authenticated") });

    expect(screen.getByText("dashboard content")).toBeInTheDocument();
  });
});

describe("T-UI-20 · app/(protected)/dashboard/page", () => {
  it("renders the placeholder with the session user's name", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ok: true, data: { user: TEST_USER } });
    renderWithProviders(<DashboardPage />, { auth: authWith("authenticated") });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Signed in as Piyush Kumar");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    await waitFor(() => expect(getCurrentUser).toHaveBeenCalledTimes(1));
  });

  it("renders nothing without a session user", () => {
    renderWithProviders(<DashboardPage />, { auth: authWith("unauthenticated") });

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
    expect(getCurrentUser).not.toHaveBeenCalled();
  });
});
