import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SuccessAck } from "@workflow-demo/contracts";

import { ToastProvider } from "@/components/ui/toast";
import { getAccessToken } from "@/lib/access-token-store";
import { resetNavigationMock, routerMock } from "@/test/navigation-mock";
import { createDeferred, createTestQueryClient, renderWithProviders, TEST_SESSION } from "@/test/render-with-providers";

import { logout, refreshSession, resetPassword } from "../api/auth-api";
import type { AuthResult } from "../lib/auth-error";
import { AuthProvider } from "../session/auth-provider";
import { useAuth } from "../session/use-auth";
import { ResetPasswordCard } from "./reset-password-card";

vi.mock("next/navigation", async () => (await import("@/test/navigation-mock")).nextNavigationMock);
vi.mock("@/features/auth/api/auth-api");

const resetPasswordMock = vi.mocked(resetPassword);
const TOKEN = "raw-reset-token";
const NEW_PASSWORD = "N3wPassw0rd!";
const INVALID_LINK_MESSAGE = "This reset link is invalid or has expired.";

afterEach(() => {
  resetNavigationMock();
  vi.mocked(resetPassword).mockReset();
  vi.mocked(refreshSession).mockReset();
  vi.mocked(logout).mockReset();
});

function fillPasswords(password: string, confirmPassword: string): void {
  fireEvent.change(screen.getByLabelText("New Password"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: confirmPassword } });
}

function submit(): void {
  fireEvent.click(screen.getByRole("button", { name: "RESET PASSWORD" }));
}

function expectInvalidLinkState(): void {
  expect(screen.getByText(INVALID_LINK_MESSAGE)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "BACK TO SIGN IN" })).toHaveAttribute("href", "/auth");
  expect(screen.queryByLabelText("New Password")).not.toBeInTheDocument();
}

describe("T-UI-07 · ResetPasswordCard", () => {
  it.each([
    ["missing", null],
    ["empty", ""],
  ])("shows the invalid-link state with a link to /auth and sends no request when the token is %s", (_label, token) => {
    renderWithProviders(<ResetPasswordCard token={token} />);

    expectInvalidLinkState();
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it("renders the new-password fields with independent eye toggles", () => {
    renderWithProviders(<ResetPasswordCard token={TOKEN} />);

    expect(screen.getByRole("heading", { level: 1, name: "Reset your password" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Show password" })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Show password" })[0] as HTMLElement);
    expect(screen.getByLabelText("New Password")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Confirm New Password")).toHaveAttribute("type", "password");
  });

  it.each([
    ["empty password", "", "", "Password is required."],
    ["short password", "Ab1!", "Ab1!", "Password must be at least 8 characters."],
    ["password without a digit", "abcdefgh!", "abcdefgh!", "Password must include a number."],
    ["password without a special character", "abcdefg1", "abcdefg1", "Password must include a special character."],
    ["empty confirmation", NEW_PASSWORD, "", "Please confirm your password."],
    ["mismatch", NEW_PASSWORD, "N3wPassw0rd?", "Passwords do not match."],
  ])("shows the inline message for %s and sends no request", async (_label, password, confirmPassword, message) => {
    renderWithProviders(<ResetPasswordCard token={TOKEN} />);
    fillPasswords(password, confirmPassword);
    submit();

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it("disables RESET PASSWORD while pending, then clears the session, toasts and goes to sign in", async () => {
    const deferred = createDeferred<AuthResult<SuccessAck>>();
    resetPasswordMock.mockReturnValue(deferred.promise);
    const { auth } = renderWithProviders(<ResetPasswordCard token={TOKEN} />);
    fillPasswords(NEW_PASSWORD, NEW_PASSWORD);
    submit();

    const button = screen.getByRole("button", { name: "RESET PASSWORD" });
    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(resetPasswordMock.mock.calls[0]?.[0]).toEqual({
      token: TOKEN,
      password: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });

    deferred.resolve({ ok: true, data: { success: true } });

    expect(await screen.findByRole("status")).toHaveTextContent("Password updated. Please sign in.");
    expect(routerMock.replace).toHaveBeenCalledWith("/auth?mode=signin");
    expect(auth.clearSession).toHaveBeenCalledTimes(1);
    expect(auth.establishSession).not.toHaveBeenCalled();
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it("ends an authenticated session without calling logout when the reset succeeds (D-12)", async () => {
    vi.mocked(refreshSession).mockResolvedValue({ ok: true, data: TEST_SESSION });
    resetPasswordMock.mockResolvedValue({ ok: true, data: { success: true } });

    function StatusProbe() {
      return <p data-testid="auth-status">{useAuth().status}</p>;
    }

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <ToastProvider>
          <AuthProvider>
            <StatusProbe />
            <ResetPasswordCard token={TOKEN} />
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getByTestId("auth-status")).toHaveTextContent(/^authenticated$/));
    expect(getAccessToken()).toBe(TEST_SESSION.accessToken);

    fillPasswords(NEW_PASSWORD, NEW_PASSWORD);
    submit();

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/auth?mode=signin"));
    expect(screen.getByTestId("auth-status")).toHaveTextContent(/^unauthenticated$/);
    expect(getAccessToken()).toBeNull();
    expect(logout).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Password updated. Please sign in.");
    expect(routerMock.replace).toHaveBeenCalledTimes(1);
  });

  it("switches to the invalid-link state on INVALID_RESET_TOKEN", async () => {
    resetPasswordMock.mockResolvedValue({ ok: false, failure: { kind: "invalid-reset-token" } });
    renderWithProviders(<ResetPasswordCard token={TOKEN} />);
    fillPasswords(NEW_PASSWORD, NEW_PASSWORD);
    submit();

    expect(await screen.findByText(INVALID_LINK_MESSAGE)).toBeInTheDocument();
    expectInvalidLinkState();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("maps VALIDATION_ERROR fieldErrors to the new-password fields inline", async () => {
    resetPasswordMock.mockResolvedValue({
      ok: false,
      failure: {
        kind: "field-errors",
        fieldErrors: { password: "Password must include a number.", confirmPassword: "Passwords do not match." },
      },
    });
    renderWithProviders(<ResetPasswordCard token={TOKEN} />);
    fillPasswords(NEW_PASSWORD, NEW_PASSWORD);
    submit();

    expect(await screen.findByText("Password must include a number.")).toBeInTheDocument();
    expect(screen.getByLabelText("New Password")).toHaveAccessibleDescription("Password must include a number.");
    expect(screen.getByLabelText("Confirm New Password")).toHaveAccessibleDescription("Passwords do not match.");
  });

  it("shows the inline reset-failed message on a 500, and clears it on the next submit", async () => {
    const deferred = createDeferred<AuthResult<SuccessAck>>();
    resetPasswordMock.mockResolvedValueOnce({ ok: false, failure: { kind: "unexpected" } });
    resetPasswordMock.mockReturnValueOnce(deferred.promise);
    renderWithProviders(<ResetPasswordCard token={TOKEN} />);
    fillPasswords(NEW_PASSWORD, NEW_PASSWORD);
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not reset your password. Please try again.");
    expect(screen.getByLabelText("New Password")).toBeInTheDocument();

    submit();
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    deferred.resolve({ ok: false, failure: { kind: "unexpected" } });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
