import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SessionPayload } from "@workflow-demo/contracts";

import {
  COMPLETE_POPUP_LABEL,
  DISMISS_POPUP_LABEL,
  EMPTY_POPUP_LABEL,
  GOOGLE_TEST_CREDENTIAL,
  googleScript,
} from "@/test/google-oauth-mock";
import { resetNavigationMock, routerMock } from "@/test/navigation-mock";
import { createDeferred, renderWithProviders, TEST_SESSION } from "@/test/render-with-providers";

import { googleOAuthLogin, login } from "../api/auth-api";
import type { AuthResult } from "../lib/auth-error";
import { AuthCard } from "./auth-card";

vi.mock("next/navigation", async () => (await import("@/test/navigation-mock")).nextNavigationMock);
vi.mock("@react-oauth/google", async () => (await import("@/test/google-oauth-mock")).googleOAuthMock);
vi.mock("@/features/auth/api/auth-api");

const googleOAuthLoginMock = vi.mocked(googleOAuthLogin);
const GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";

afterEach(() => {
  resetNavigationMock();
  googleOAuthLoginMock.mockReset();
  vi.mocked(login).mockReset();
});

function renderCard(googleClientId: string | null = GOOGLE_CLIENT_ID) {
  return renderWithProviders(<AuthCard />, { googleClientId });
}

/** Buttons of the visible (sign-in) panel; the hidden panel is aria-hidden and excluded by role queries. */
function visibleButton(name: string): HTMLElement {
  return screen.getByRole("button", { name });
}

describe("T-UI-05 · Google sign-in button", () => {
  it("renders the fallback button on both panels when no client ID is configured and toasts on click", async () => {
    renderCard(null);

    expect(screen.getAllByRole("button", { name: "Sign in with Google", hidden: true })).toHaveLength(2);
    fireEvent.click(visibleButton("Sign in with Google"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Google sign-in is unavailable.");
    expect(googleOAuthLoginMock).not.toHaveBeenCalled();
  });

  it("falls back to the unavailable button when the Google script fails to load", async () => {
    renderCard();
    expect(screen.queryByRole("button", { name: "Sign in with Google" })).not.toBeInTheDocument();

    act(() => googleScript.failToLoad());
    fireEvent.click(await screen.findByRole("button", { name: "Sign in with Google" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Google sign-in is unavailable.");
  });

  it("does nothing when the popup is dismissed or returns no credential", () => {
    renderCard();
    // Role queries skip the aria-hidden sign-up panel, so this is the visible sign-in email field.
    const emailInput = screen.getByRole("textbox", { name: "Email" });
    fireEvent.change(emailInput, { target: { value: "typed@example.com" } });

    fireEvent.click(visibleButton(DISMISS_POPUP_LABEL));
    fireEvent.click(visibleButton(EMPTY_POPUP_LABEL));

    expect(googleOAuthLoginMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(routerMock.replace).not.toHaveBeenCalled();
    expect(emailInput).toHaveValue("typed@example.com");
  });

  it("sends { token: credential }, establishes the session and replaces the route with /dashboard", async () => {
    googleOAuthLoginMock.mockResolvedValue({ ok: true, data: TEST_SESSION });
    const { auth } = renderCard();

    fireEvent.click(visibleButton(COMPLETE_POPUP_LABEL));

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/dashboard"));
    expect(googleOAuthLoginMock.mock.calls[0]?.[0]).toEqual({ token: GOOGLE_TEST_CREDENTIAL });
    expect(auth.establishSession).toHaveBeenCalledWith(TEST_SESSION);
  });

  it.each([
    ["INVALID_GOOGLE_TOKEN", "invalid-google-token"],
    ["a 500 or network failure", "unexpected"],
  ] as const)("shows the Google-failed toast on %s", async (_label, kind) => {
    googleOAuthLoginMock.mockResolvedValue({ ok: false, failure: { kind } });
    const { auth } = renderCard();

    fireEvent.click(visibleButton(COMPLETE_POPUP_LABEL));

    expect(await screen.findByRole("alert")).toHaveTextContent("Google sign-in failed. Please try again.");
    expect(auth.establishSession).not.toHaveBeenCalled();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("shows a spinner on both Google buttons and disables both forms' submits while pending", async () => {
    const deferred = createDeferred<AuthResult<SessionPayload>>();
    googleOAuthLoginMock.mockReturnValue(deferred.promise);
    renderCard();

    fireEvent.click(visibleButton(COMPLETE_POPUP_LABEL));

    await waitFor(() => expect(visibleButton("SIGN IN")).toBeDisabled());
    const hiddenSignUpSubmit = screen
      .getAllByRole("button", { name: "SIGN UP", hidden: true })
      .find((button) => button.getAttribute("type") === "submit");
    expect(hiddenSignUpSubmit).toBeDisabled();
    expect(screen.getAllByRole("status", { hidden: true })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: COMPLETE_POPUP_LABEL })).not.toBeInTheDocument();

    deferred.resolve({ ok: false, failure: { kind: "unexpected" } });
    await waitFor(() => expect(visibleButton("SIGN IN")).toBeEnabled());
    expect(googleOAuthLoginMock).toHaveBeenCalledTimes(1);
  });
});
