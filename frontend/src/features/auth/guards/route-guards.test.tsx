import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resetNavigationMock, routerMock } from "@/test/navigation-mock";
import { createFakeAuth, renderWithProviders, TEST_USER } from "@/test/render-with-providers";

import type { AuthStatus } from "../session/use-auth";
import { GuestOnlyRoute } from "./guest-only-route";
import { ProtectedRoute } from "./protected-route";

vi.mock("next/navigation", async () => (await import("@/test/navigation-mock")).nextNavigationMock);

afterEach(() => {
  resetNavigationMock();
});

function authWith(status: AuthStatus) {
  return createFakeAuth({ status, user: status === "authenticated" ? TEST_USER : null });
}

function expectLoader(): void {
  expect(screen.getByRole("status")).toHaveTextContent("Loading…");
}

describe("T-UI-10 · ProtectedRoute", () => {
  it("shows the loader, not the children and no redirect, while the session restores", () => {
    renderWithProviders(<ProtectedRoute>protected content</ProtectedRoute>, { auth: authWith("loading") });

    expectLoader();
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("replaces the route with /auth and keeps the loader when unauthenticated", () => {
    renderWithProviders(<ProtectedRoute>protected content</ProtectedRoute>, { auth: authWith("unauthenticated") });

    expect(routerMock.replace).toHaveBeenCalledWith("/auth");
    expectLoader();
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
  });

  it("renders the children when authenticated", () => {
    renderWithProviders(<ProtectedRoute>protected content</ProtectedRoute>, { auth: authWith("authenticated") });

    expect(screen.getByText("protected content")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });
});

describe("T-UI-10 · GuestOnlyRoute", () => {
  it("shows the loader, not the form, while the session restores", () => {
    renderWithProviders(<GuestOnlyRoute>sign-in form</GuestOnlyRoute>, { auth: authWith("loading") });

    expectLoader();
    expect(screen.queryByText("sign-in form")).not.toBeInTheDocument();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("replaces the route with /dashboard and keeps the loader when authenticated", () => {
    renderWithProviders(<GuestOnlyRoute>sign-in form</GuestOnlyRoute>, { auth: authWith("authenticated") });

    expect(routerMock.replace).toHaveBeenCalledWith("/dashboard");
    expectLoader();
    expect(screen.queryByText("sign-in form")).not.toBeInTheDocument();
  });

  it("renders the children when unauthenticated", () => {
    renderWithProviders(<GuestOnlyRoute>sign-in form</GuestOnlyRoute>, { auth: authWith("unauthenticated") });

    expect(screen.getByText("sign-in form")).toBeInTheDocument();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });
});
