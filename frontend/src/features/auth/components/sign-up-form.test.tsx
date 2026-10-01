import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SessionPayload } from "@workflow-demo/contracts";

import { resetNavigationMock, routerMock } from "@/test/navigation-mock";
import { createDeferred, renderWithProviders, TEST_SESSION } from "@/test/render-with-providers";

import { register } from "../api/auth-api";
import type { GoogleSignInControls } from "../hooks/use-google-sign-in";
import type { AuthResult } from "../lib/auth-error";
import { SignUpForm } from "./sign-up-form";

vi.mock("next/navigation", async () => (await import("@/test/navigation-mock")).nextNavigationMock);
vi.mock("@/features/auth/api/auth-api");

const registerMock = vi.mocked(register);

const VALID_VALUES = {
  name: "Piyush Kumar",
  email: "piyush@example.com",
  password: "Passw0rd!",
  confirmPassword: "Passw0rd!",
};

type SignUpValues = typeof VALID_VALUES;

afterEach(() => {
  resetNavigationMock();
  registerMock.mockReset();
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

function renderSignUpForm(google: GoogleSignInControls = createGoogleControls()) {
  return renderWithProviders(<SignUpForm isActive google={google} />);
}

function fillForm(values: Partial<SignUpValues>): void {
  const merged = { ...VALID_VALUES, ...values };
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: merged.name } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: merged.email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: merged.password } });
  fireEvent.change(screen.getByLabelText("Confirm Password"), { target: { value: merged.confirmPassword } });
}

function submit(): void {
  fireEvent.click(screen.getByRole("button", { name: "SIGN UP" }));
}

describe("T-UI-02 · SignUpForm", () => {
  it("renders the title, divider and the four fields with their autocomplete hints", () => {
    renderSignUpForm();

    expect(screen.getByRole("heading", { level: 1, name: "Create Account" })).toBeInTheDocument();
    expect(screen.getByText("or use your email for registration")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveAttribute("autocomplete", "name");
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByLabelText("Confirm Password")).toHaveAttribute("autocomplete", "new-password");
  });

  it.each<[string, Partial<SignUpValues>, string]>([
    ["empty name", { name: "" }, "Name is required."],
    ["whitespace-only name", { name: "   " }, "Name is required."],
    ["1-character name", { name: "A" }, "Name must be at least 2 characters."],
    ["empty email", { email: "" }, "Email is required."],
    ["malformed email", { email: "user@" }, "Enter a valid email address."],
    ["empty password", { password: "", confirmPassword: "" }, "Password is required."],
    [
      "7-character password",
      { password: "Abc12!x", confirmPassword: "Abc12!x" },
      "Password must be at least 8 characters.",
    ],
    [
      "password without a digit",
      { password: "abcdefgh!", confirmPassword: "abcdefgh!" },
      "Password must include a number.",
    ],
    [
      "password without a special character",
      { password: "abcdefg1", confirmPassword: "abcdefg1" },
      "Password must include a special character.",
    ],
    ["empty confirm password", { confirmPassword: "" }, "Please confirm your password."],
    ["mismatched confirm password", { confirmPassword: "Passw0rd?" }, "Passwords do not match."],
  ])("shows the inline message for %s and sends no request", async (_label, values, message) => {
    renderSignUpForm();
    fillForm(values);
    submit();

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it("flags every empty field at once, marks them invalid and focuses the first one", async () => {
    renderSignUpForm();
    submit();

    expect(await screen.findByText("Name is required.")).toBeInTheDocument();
    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(screen.getByText("Please confirm your password.")).toBeInTheDocument();
    const nameInput = screen.getByLabelText("Name");
    expect(nameInput).toHaveAttribute("aria-invalid", "true");
    expect(nameInput).toHaveAccessibleDescription("Name is required.");
    await waitFor(() => expect(nameInput).toHaveFocus());
    expect(registerMock).not.toHaveBeenCalled();
  });

  it.each([
    ["space", "abcdefg 1"],
    ["underscore", "abcdefg_1"],
  ])("accepts a %s as the special character", async (_label, password) => {
    registerMock.mockResolvedValue({ ok: true, data: TEST_SESSION });
    renderSignUpForm();
    fillForm({ password, confirmPassword: password });
    submit();

    await waitFor(() => expect(registerMock).toHaveBeenCalledTimes(1));
    expect(registerMock.mock.calls[0]?.[0]).toMatchObject({ password, confirmPassword: password });
  });

  it("disables the submit button with a loading state while the request is pending", async () => {
    const deferred = createDeferred<AuthResult<SessionPayload>>();
    registerMock.mockReturnValue(deferred.promise);
    renderSignUpForm();
    fillForm({});
    submit();

    const button = screen.getByRole("button", { name: "SIGN UP" });
    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute("aria-busy", "true");

    deferred.resolve({ ok: false, failure: { kind: "unexpected" } });
    await waitFor(() => expect(button).toBeEnabled());
  });

  it("establishes the session and replaces the route with /dashboard on success", async () => {
    registerMock.mockResolvedValue({ ok: true, data: TEST_SESSION });
    const { auth } = renderSignUpForm();
    fillForm({});
    submit();

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/dashboard"));
    expect(registerMock.mock.calls[0]?.[0]).toEqual(VALID_VALUES);
    expect(auth.establishSession).toHaveBeenCalledWith(TEST_SESSION);
  });

  it("shows the email-exists toast on 409 EMAIL_ALREADY_EXISTS", async () => {
    registerMock.mockResolvedValue({ ok: false, failure: { kind: "email-exists" } });
    const { auth } = renderSignUpForm();
    fillForm({});
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent("An account with this email already exists.");
    expect(auth.establishSession).not.toHaveBeenCalled();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("shows the sign-up-failed toast on a network failure or 500", async () => {
    registerMock.mockResolvedValue({ ok: false, failure: { kind: "unexpected" } });
    renderSignUpForm();
    fillForm({});
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not create your account. Please try again.");
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("shows server fieldErrors inline", async () => {
    registerMock.mockResolvedValue({
      ok: false,
      failure: { kind: "field-errors", fieldErrors: { email: "Enter a valid email address.", token: "ignored" } },
    });
    renderSignUpForm();
    fillForm({});
    submit();

    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("ignored")).not.toBeInTheDocument();
  });

  it("disables the submit button while a Google sign-in is pending", () => {
    renderSignUpForm(createGoogleControls({ isPending: true }));

    expect(screen.getByRole("button", { name: "SIGN UP" })).toBeDisabled();
  });
});
