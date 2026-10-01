import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ForgotPasswordAck } from "@workflow-demo/contracts";

import { createDeferred, renderWithProviders } from "@/test/render-with-providers";

import { requestPasswordReset } from "../api/auth-api";
import type { AuthResult } from "../lib/auth-error";
import { ForgotPasswordDialog } from "./forgot-password-dialog";

vi.mock("@/features/auth/api/auth-api");

const requestPasswordResetMock = vi.mocked(requestPasswordReset);
const GENERIC_MESSAGE = "If an account exists for that email, a reset link has been sent.";

afterEach(() => {
  requestPasswordResetMock.mockReset();
});

function openDialog(): HTMLElement {
  fireEvent.click(screen.getByRole("button", { name: "Forgot your password?" }));
  return screen.getByRole("dialog");
}

function submitEmail(dialog: HTMLElement, email: string): void {
  fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: email } });
  fireEvent.click(within(dialog).getByRole("button", { name: "SEND RESET LINK" }));
}

describe("T-UI-06 · ForgotPasswordDialog", () => {
  it("opens with the title, an email field and SEND RESET LINK", () => {
    renderWithProviders(<ForgotPasswordDialog />);

    const dialog = openDialog();

    expect(dialog).toHaveAccessibleName("Reset your password");
    expect(within(dialog).getByLabelText("Email")).toHaveValue("");
    expect(within(dialog).getByRole("button", { name: "SEND RESET LINK" })).toBeInTheDocument();
  });

  it.each([
    ["empty", "", "Email is required."],
    ["malformed", "user@", "Enter a valid email address."],
  ])("flags an %s email inline and sends no request", async (_label, email, message) => {
    renderWithProviders(<ForgotPasswordDialog />);
    const dialog = openDialog();

    submitEmail(dialog, email);

    expect(await within(dialog).findByText(message)).toBeInTheDocument();
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
  });

  it("disables SEND RESET LINK while pending, then shows the server message and BACK TO SIGN IN, which closes", async () => {
    const deferred = createDeferred<AuthResult<ForgotPasswordAck>>();
    requestPasswordResetMock.mockReturnValue(deferred.promise);
    renderWithProviders(<ForgotPasswordDialog />);
    const dialog = openDialog();

    submitEmail(dialog, "piyush@example.com");
    const sendButton = within(dialog).getByRole("button", { name: "SEND RESET LINK" });
    await waitFor(() => expect(sendButton).toBeDisabled());
    expect(sendButton).toHaveAttribute("aria-busy", "true");
    expect(requestPasswordResetMock.mock.calls[0]?.[0]).toEqual({ email: "piyush@example.com" });

    deferred.resolve({ ok: true, data: { success: true, message: GENERIC_MESSAGE } });
    expect(await within(dialog).findByRole("status")).toHaveTextContent(GENERIC_MESSAGE);
    expect(within(dialog).queryByLabelText("Email")).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "BACK TO SIGN IN" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("falls back to the generic message when the server message is empty", async () => {
    requestPasswordResetMock.mockResolvedValue({ ok: true, data: { success: true, message: "" } });
    renderWithProviders(<ForgotPasswordDialog />);
    const dialog = openDialog();

    submitEmail(dialog, "nobody@example.com");

    expect(await within(dialog).findByRole("status")).toHaveTextContent(GENERIC_MESSAGE);
  });

  it("shows the inline failure, keeps the form open and keeps the value when the request fails", async () => {
    requestPasswordResetMock.mockResolvedValue({ ok: false, failure: { kind: "unexpected" } });
    renderWithProviders(<ForgotPasswordDialog />);
    const dialog = openDialog();

    submitEmail(dialog, "piyush@example.com");

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Could not send the reset link. Please try again."
    );
    expect(within(dialog).getByLabelText("Email")).toHaveValue("piyush@example.com");
    expect(within(dialog).getByRole("button", { name: "SEND RESET LINK" })).toBeEnabled();
  });

  it("shows a server field error inline", async () => {
    requestPasswordResetMock.mockResolvedValue({
      ok: false,
      failure: { kind: "field-errors", fieldErrors: { email: "Enter a valid email address." } },
    });
    renderWithProviders(<ForgotPasswordDialog />);
    const dialog = openDialog();

    submitEmail(dialog, "piyush@example.com");

    expect(await within(dialog).findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not submit an enclosing form", async () => {
    const outerSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    requestPasswordResetMock.mockResolvedValue({ ok: true, data: { success: true, message: GENERIC_MESSAGE } });
    renderWithProviders(
      <form onSubmit={outerSubmit}>
        <ForgotPasswordDialog />
      </form>
    );
    const dialog = openDialog();

    submitEmail(dialog, "piyush@example.com");

    expect(await within(dialog).findByRole("status")).toBeInTheDocument();
    expect(outerSubmit).not.toHaveBeenCalled();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    renderWithProviders(<ForgotPasswordDialog />);
    const trigger = screen.getByRole("button", { name: "Forgot your password?" });
    const dialog = openDialog();

    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("closes on an outside click on the overlay", async () => {
    renderWithProviders(<ForgotPasswordDialog />);
    openDialog();
    const overlay = document.body.querySelector<HTMLElement>(".fixed.inset-0");
    expect(overlay).not.toBeNull();

    // Radix registers its outside-pointer listener on the next tick after opening.
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Radix defers a primary-button outside dismissal to the click that completes it, so send the whole sequence.
    const target = overlay as HTMLElement;
    fireEvent.pointerDown(target, { button: 0 });
    fireEvent.mouseDown(target, { button: 0 });
    fireEvent.pointerUp(target, { button: 0 });
    fireEvent.mouseUp(target, { button: 0 });
    fireEvent.click(target, { button: 0 });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes via the Close control", async () => {
    renderWithProviders(<ForgotPasswordDialog />);
    const dialog = openDialog();

    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("reopens on an empty request step after a failure or a success", async () => {
    requestPasswordResetMock.mockResolvedValueOnce({ ok: false, failure: { kind: "unexpected" } });
    requestPasswordResetMock.mockResolvedValueOnce({ ok: true, data: { success: true, message: GENERIC_MESSAGE } });
    renderWithProviders(<ForgotPasswordDialog />);

    let dialog = openDialog();
    submitEmail(dialog, "piyush@example.com");
    expect(await within(dialog).findByRole("alert")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    dialog = openDialog();
    expect(within(dialog).getByLabelText("Email")).toHaveValue("");
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    submitEmail(dialog, "piyush@example.com");
    expect(await within(dialog).findByRole("status")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    dialog = openDialog();
    expect(within(dialog).getByLabelText("Email")).toHaveValue("");
    expect(within(dialog).queryByRole("status")).not.toBeInTheDocument();
  });
});
