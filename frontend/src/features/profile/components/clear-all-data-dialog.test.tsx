import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProfileSuccessAck } from "@workflow-demo/contracts";

import { createDeferred, renderWithProviders } from "@/test/render-with-providers";

import { clearAllData } from "../api/profile-api";
import type { ProfileResult } from "../lib/profile-error";
import { ClearAllDataDialog } from "./clear-all-data-dialog";

vi.mock("../api/profile-api");

const clearAllDataMock = vi.mocked(clearAllData);

const WARNING_MESSAGE =
  "Are you sure you want to reset your profile data? This will permanently reset your avatar and notification preferences to their defaults. This action cannot be undone.";

afterEach(() => {
  clearAllDataMock.mockReset();
});

function openDialog(): HTMLElement {
  fireEvent.click(screen.getByRole("button", { name: "Clear All Data" }));
  return screen.getByRole("alertdialog");
}

describe("T-UI-07 · ClearAllDataDialog", () => {
  it("shows the exact warning copy from behavior.md §5 (D-18)", () => {
    renderWithProviders(<ClearAllDataDialog />);
    const dialog = openDialog();

    expect(within(dialog).getAllByText(WARNING_MESSAGE).length).toBeGreaterThan(0);
  });

  it("disables the confirm button until exactly DELETE is typed", () => {
    renderWithProviders(<ClearAllDataDialog />);
    const dialog = openDialog();
    const confirmButton = within(dialog).getByRole("button", { name: "Clear All Data" });
    const input = within(dialog).getByLabelText("Type DELETE to confirm");

    expect(confirmButton).toBeDisabled();

    fireEvent.change(input, { target: { value: "delete" } });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(input, { target: { value: "DELET" } });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(input, { target: { value: "DELETE" } });
    expect(confirmButton).toBeEnabled();
  });

  it("shows the exact success toast and closes the dialog on confirm", async () => {
    const successAck: ProfileSuccessAck = { success: true, message: "All profile data has been cleared." };
    clearAllDataMock.mockResolvedValue({ ok: true, data: successAck });
    renderWithProviders(<ClearAllDataDialog />);
    const dialog = openDialog();
    fireEvent.change(within(dialog).getByLabelText("Type DELETE to confirm"), { target: { value: "DELETE" } });

    fireEvent.click(within(dialog).getByRole("button", { name: "Clear All Data" }));

    expect(await screen.findByText("All profile data has been cleared.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(clearAllDataMock.mock.calls[0]?.[0]).toEqual({ confirmation: "DELETE" });
  });

  it("disables the confirm button while pending", async () => {
    const deferred = createDeferred<ProfileResult<ProfileSuccessAck>>();
    clearAllDataMock.mockReturnValue(deferred.promise);
    renderWithProviders(<ClearAllDataDialog />);
    const dialog = openDialog();
    fireEvent.change(within(dialog).getByLabelText("Type DELETE to confirm"), { target: { value: "DELETE" } });
    const confirmButton = within(dialog).getByRole("button", { name: "Clear All Data" });

    fireEvent.click(confirmButton);

    await waitFor(() => expect(confirmButton).toBeDisabled());
    deferred.resolve({ ok: true, data: { success: true, message: "All profile data has been cleared." } });
  });

  it("keeps the dialog open with an inline alert on failure", async () => {
    clearAllDataMock.mockResolvedValue({ ok: false, failure: { kind: "unexpected" } });
    renderWithProviders(<ClearAllDataDialog />);
    const dialog = openDialog();
    fireEvent.change(within(dialog).getByLabelText("Type DELETE to confirm"), { target: { value: "DELETE" } });

    fireEvent.click(within(dialog).getByRole("button", { name: "Clear All Data" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Couldn't clear your data. Please try again.");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
