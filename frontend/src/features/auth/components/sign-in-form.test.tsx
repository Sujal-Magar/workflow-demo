import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SessionPayload } from "@workflow-demo/contracts";

import { resetNavigationMock, routerMock } from "@/test/navigation-mock";
import { createDeferred, renderWithProviders, TEST_SESSION } from "@/test/render-with-providers";

import { login, refreshSession } from "../api/auth-api";
import type { GoogleSignInControls } from "../hooks/use-google-sign-in";
import type { AuthResult } from "../lib/auth-error";
import { SignInForm } from "./sign-in-form";

vi.mock("next/navigation", async () => (await import("@/test/navigation-mock")).nextNavigationMock);
vi.mock("@/features/auth/api/auth-api");

const loginMock = vi.mocked(login);
const SHAKE_CLASS = "motion-safe:animate-shake";

afterEach(() => {
  resetNavigationMock();
  vi.mocked(login).mockReset();
  vi.mocked(refreshSession).mockReset();
});

function createGoogleControls(overrides: Partial<GoogleSignInControls> = {}): GoogleSignInControls {
  return {
    isPending: false,
    handleCredentialResponse: vi.fn(),
    handleGoogleError: vi.fn(),
    notifyUnavailable: vi.fn(),
    ...overrides,
  };
}

function renderSignInForm(google: GoogleSignInControls = createGoogleControls()) {
  return renderWithProviders(<SignInForm isActive google={google} />);
}

function fillForm(email: string, password: string): void {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
}

function submit(): void {
  fireEvent.click(screen.getByRole("button", { name: "SIGN IN" }));
}

/** The box around an input that carries the shake animation. */
function shakeBoxOf(label: string): HTMLElement {
  return screen.getByLabelText(label).parentElement as HTMLElement;
}

describe("T-UI-03 · SignInForm", () => {
  it("renders the title, divider, fields and the forgot-password link", () => {
    renderSignInForm();

    expect(screen.getByRole("heading", { level: 1, name: "Sign in to FinTrack" })).toBeInTheDocument();
    expect(screen.getByText("or use your account")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByRole("button", { name: "Forgot your password?" })).toBeInTheDocument();
  });

  it.each([
    ["empty email", "", "secret", "Email is required."],
    ["malformed email", "user@", "secret", "Enter a valid email address."],
    ["empty password", "piyush@example.com", "", "Password is required."],
  ])("flags %s inline and sends no request", async (_label, email, password, message) => {
    renderSignInForm();
    fillForm(email, password);
    submit();

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("accepts a weak password client-side (no strength rule on sign in)", async () => {
    loginMock.mockResolvedValue({ ok: false, failure: { kind: "invalid-credentials" } });
    renderSignInForm();
    fillForm("piyush@example.com", "x");
    submit();

    await waitFor(() => expect(loginMock).toHaveBeenCalledTimes(1));
    expect(loginMock.mock.calls[0]?.[0]).toEqual({ email: "piyush@example.com", password: "x" });
  });

  it("disables the submit button with a loading state while pending", async () => {
    const deferred = createDeferred<AuthResult<SessionPayload>>();
    loginMock.mockReturnValue(deferred.promise);
    renderSignInForm();
    fillForm("piyush@example.com", "Passw0rd!");
    submit();

    const button = screen.getByRole("button", { name: "SIGN IN" });
    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute("aria-busy", "true");

    deferred.resolve({ ok: false, failure: { kind: "invalid-credentials" } });
    await waitFor(() => expect(button).toBeEnabled());
  });

  it("shows the invalid-credentials alert, shakes both inputs, keeps values and never refreshes", async () => {
    loginMock.mockResolvedValue({ ok: false, failure: { kind: "invalid-credentials" } });
    const { auth } = renderSignInForm();
    fillForm("piyush@example.com", "wrong-password");

    expect(shakeBoxOf("Email")).not.toHaveClass(SHAKE_CLASS);
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(shakeBoxOf("Email")).toHaveClass(SHAKE_CLASS);
    expect(shakeBoxOf("Password")).toHaveClass(SHAKE_CLASS);
    expect(screen.getByLabelText("Email")).toHaveValue("piyush@example.com");
    expect(screen.getByLabelText("Password")).toHaveValue("wrong-password");
    expect(refreshSession).not.toHaveBeenCalled();
    expect(auth.refreshSession).not.toHaveBeenCalled();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("clears the alert on the next submit and shows it again after another failure", async () => {
    const deferred = createDeferred<AuthResult<SessionPayload>>();
    loginMock.mockResolvedValueOnce({ ok: false, failure: { kind: "invalid-credentials" } });
    loginMock.mockReturnValueOnce(deferred.promise);
    renderSignInForm();
    fillForm("piyush@example.com", "wrong-password");
    submit();
    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();

    submit();
    await waitFor(() => expect(screen.queryByText("Invalid email or password")).not.toBeInTheDocument());

    deferred.resolve({ ok: false, failure: { kind: "invalid-credentials" } });
    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
    expect(shakeBoxOf("Email")).toHaveClass(SHAKE_CLASS);
  });

  it("shows the sign-in-failed toast on a network failure or 500", async () => {
    loginMock.mockResolvedValue({ ok: false, failure: { kind: "unexpected" } });
    renderSignInForm();
    fillForm("piyush@example.com", "Passw0rd!");
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not sign in. Please try again.");
    expect(screen.queryByText("Invalid email or password")).not.toBeInTheDocument();
  });

  it("shows server fieldErrors inline", async () => {
    loginMock.mockResolvedValue({
      ok: false,
      failure: { kind: "field-errors", fieldErrors: { password: "Password is required." } },
    });
    renderSignInForm();
    fillForm("piyush@example.com", "Passw0rd!");
    submit();

    expect(await screen.findByText("Password is required.")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
  });

  it("establishes the session and replaces the route with /dashboard on success", async () => {
    loginMock.mockResolvedValue({ ok: true, data: TEST_SESSION });
    const { auth } = renderSignInForm();
    fillForm("piyush@example.com", "Passw0rd!");
    submit();

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/dashboard"));
    expect(auth.establishSession).toHaveBeenCalledWith(TEST_SESSION);
  });

  it("disables the submit button while a Google sign-in is pending", () => {
    renderSignInForm(createGoogleControls({ isPending: true }));

    expect(screen.getByRole("button", { name: "SIGN IN" })).toBeDisabled();
  });
});
