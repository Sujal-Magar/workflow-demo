import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createDeferred, renderWithProviders } from "@/test/render-with-providers";

import { changePassword } from "../api/profile-api";
import type { ProfileResult } from "../lib/profile-error";
import { ChangePasswordDialog } from "./change-password-dialog";

vi.mock("../api/profile-api");

const changePasswordMock = vi.mocked(changePassword);

afterEach(() => {
  changePasswordMock.mockReset();
});

function openDialog(): HTMLElement {
  fireEvent.click(screen.getByRole("button", { name: "Change Password" }));
  return screen.getByRole("dialog");
}

function fillForm(dialog: HTMLElement, values: { current?: string; next?: string; confirm?: string }): void {
  if (values.current !== undefined) {
    fireEvent.change(within(dialog).getByLabelText("Current Password"), { target: { value: values.current } });
  }
  if (values.next !== undefined) {
    fireEvent.change(within(dialog).getByLabelText("New Password"), { target: { value: values.next } });
  }
  if (values.confirm !== undefined) {
    fireEvent.change(within(dialog).getByLabelText("Confirm New Password"), { target: { value: values.confirm } });
  }
}

function submit(dialog: HTMLElement): void {
  fireEvent.click(within(dialog).getByRole("button", { name: "Change Password" }));
}

describe("T-UI-04 · ChangePasswordDialog", () => {
  it("renders Current Password, New Password and Confirm New Password fields", () => {
    renderWithProviders(<ChangePasswordDialog />);
    const dialog = openDialog();

    expect(within(dialog).getByLabelText("Current Password")).toHaveValue("");
    expect(within(dialog).getByLabelText("New Password")).toHaveValue("");
    expect(within(dialog).getByLabelText("Confirm New Password")).toHaveValue("");
  });

  it.each<[string, { current?: string; next?: string; confirm?: string }, string]>([
    [
      "empty current password",
      { current: "", next: "Passw0rd!", confirm: "Passw0rd!" },
      "Current password is required.",
    ],
    ["short new password", { current: "x", next: "Ab1!", confirm: "Ab1!" }, "Password must be at least 8 characters."],
    [
      "new password without a digit",
      { current: "x", next: "abcdefgh!", confirm: "abcdefgh!" },
      "Password must include a number.",
    ],
    [
      "new password without a special character",
      { current: "x", next: "abcdefg1", confirm: "abcdefg1" },
      "Password must include a special character.",
    ],
    ["empty confirmation", { current: "x", next: "Passw0rd!", confirm: "" }, "Please confirm your password."],
  ])("shows the client-side inline message for %s and sends no request", async (_label, values, message) => {
    renderWithProviders(<ChangePasswordDialog />);
    const dialog = openDialog();
    fillForm(dialog, values);
    submit(dialog);

    expect(await within(dialog).findByText(message)).toBeInTheDocument();
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it("disables Change Password while pending and shows the success toast, closing the dialog", async () => {
    const deferred = createDeferred<ProfileResult<{ success: true }>>();
    changePasswordMock.mockReturnValue(deferred.promise);
    renderWithProviders(<ChangePasswordDialog />);
    const dialog = openDialog();
    fillForm(dialog, { current: "OldPassw0rd!", next: "NewPassw0rd!", confirm: "NewPassw0rd!" });
    submit(dialog);

    const button = within(dialog).getByRole("button", { name: "Change Password" });
    await waitFor(() => expect(button).toBeDisabled());
    expect(changePasswordMock.mock.calls[0]?.[0]).toEqual({
      currentPassword: "OldPassw0rd!",
      newPassword: "NewPassw0rd!",
      confirmPassword: "NewPassw0rd!",
    });

    deferred.resolve({ ok: true, data: { success: true } });

    expect(await screen.findByText("Password updated successfully!")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("maps 401 INVALID_CREDENTIALS to the exact inline error on Current Password", async () => {
    changePasswordMock.mockResolvedValue({ ok: false, failure: { kind: "invalid-credentials" } });
    renderWithProviders(<ChangePasswordDialog />);
    const dialog = openDialog();
    fillForm(dialog, { current: "WrongPass1!", next: "NewPassw0rd!", confirm: "NewPassw0rd!" });
    submit(dialog);

    expect(await within(dialog).findByText("Incorrect current password.")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Current Password")).toHaveAccessibleDescription(
      "Incorrect current password."
    );
  });

  it("maps a same-password failure to an inline error on New Password", async () => {
    changePasswordMock.mockResolvedValue({ ok: false, failure: { kind: "same-password" } });
    renderWithProviders(<ChangePasswordDialog />);
    const dialog = openDialog();
    fillForm(dialog, { current: "Passw0rd!", next: "Passw0rd!", confirm: "Passw0rd!" });
    submit(dialog);

    expect(
      await within(dialog).findByText("New password must be different from your current password.")
    ).toBeInTheDocument();
  });

  it("maps a passwords-do-not-match failure to an inline error on Confirm New Password", async () => {
    changePasswordMock.mockResolvedValue({ ok: false, failure: { kind: "passwords-do-not-match" } });
    renderWithProviders(<ChangePasswordDialog />);
    const dialog = openDialog();
    fillForm(dialog, { current: "OldPassw0rd!", next: "NewPassw0rd!", confirm: "Different1!" });
    submit(dialog);

    expect(await within(dialog).findByText("New password and confirmation do not match.")).toBeInTheDocument();
  });

  it("shows the Google-SSO/no-password guidance reactively on first submit (D-10)", async () => {
    changePasswordMock.mockResolvedValue({ ok: false, failure: { kind: "password-not-set" } });
    renderWithProviders(<ChangePasswordDialog />);
    const dialog = openDialog();
    fillForm(dialog, { current: "anything", next: "NewPassw0rd!", confirm: "NewPassw0rd!" });
    submit(dialog);

    expect(
      await within(dialog).findByText("No password is set for this account. Use password recovery instead.")
    ).toBeInTheDocument();
  });

  it("shows the rate-limit alert and disables the submit button", async () => {
    changePasswordMock.mockResolvedValue({ ok: false, failure: { kind: "rate-limit-exceeded" } });
    renderWithProviders(<ChangePasswordDialog />);
    const dialog = openDialog();
    fillForm(dialog, { current: "OldPassw0rd!", next: "NewPassw0rd!", confirm: "NewPassw0rd!" });
    submit(dialog);

    expect(
      await within(dialog).findByText("Too many password change attempts. Please try again later.")
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Change Password" })).toBeDisabled();
  });

  it("maps server fieldErrors onto the matching field", async () => {
    changePasswordMock.mockResolvedValue({
      ok: false,
      failure: { kind: "field-errors", fieldErrors: { newPassword: "Password must include a number." } },
    });
    renderWithProviders(<ChangePasswordDialog />);
    const dialog = openDialog();
    fillForm(dialog, { current: "OldPassw0rd!", next: "NewPassword!", confirm: "NewPassword!" });
    submit(dialog);

    expect(await within(dialog).findByText("Password must include a number.")).toBeInTheDocument();
  });
});
