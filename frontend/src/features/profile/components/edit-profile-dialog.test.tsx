import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { UserProfile } from "@workflow-demo/contracts";

import { renderWithProviders } from "@/test/render-with-providers";

import { updateProfile } from "../api/profile-api";
import { EditProfileDialog } from "./edit-profile-dialog";

vi.mock("../api/profile-api");

const updateProfileMock = vi.mocked(updateProfile);

const TEST_PROFILE: UserProfile = {
  id: "user-1",
  name: "Piyush Kumar",
  email: "piyush@example.com",
  avatarUrl: null,
  preferredCurrency: "NPR",
  language: "en_US",
  monthlyStartDate: 1,
  notificationPreferences: { budgetLimitAlerts: true, goalReminders: true, weeklySummaryEmails: true },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

afterEach(() => {
  updateProfileMock.mockReset();
});

function openDialog(): HTMLElement {
  fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
  return screen.getByRole("dialog");
}

describe("T-UI-03 · EditProfileDialog", () => {
  it("renders only the Display Name and Avatar URL fields — no email field (D-02)", () => {
    renderWithProviders(<EditProfileDialog profile={TEST_PROFILE} />);
    const dialog = openDialog();

    expect(within(dialog).getByLabelText("Display Name")).toHaveValue(TEST_PROFILE.name);
    expect(within(dialog).getByLabelText("Avatar URL")).toHaveValue("");
    expect(within(dialog).queryByLabelText("Email")).not.toBeInTheDocument();
    expect(within(dialog).queryByText(TEST_PROFILE.email)).not.toBeInTheDocument();
  });

  it.each<[string, string, string]>([
    ["empty name", "", "Name is required."],
    ["1-character name", "A", "Name must be at least 2 characters."],
    ["101-character name", "a".repeat(101), "Name must be at most 100 characters."],
  ])("shows the inline message for %s and sends no request (D-09)", async (_label, name, message) => {
    renderWithProviders(<EditProfileDialog profile={TEST_PROFILE} />);
    const dialog = openDialog();

    fireEvent.change(within(dialog).getByLabelText("Display Name"), { target: { value: name } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Changes" }));

    expect(await within(dialog).findByText(message)).toBeInTheDocument();
    expect(updateProfileMock).not.toHaveBeenCalled();
  });

  it("updates the live avatar preview as the Avatar URL field changes", () => {
    renderWithProviders(<EditProfileDialog profile={TEST_PROFILE} />);
    const dialog = openDialog();

    expect(within(dialog).queryByRole("img")).not.toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Avatar URL"), {
      target: { value: "https://example.com/avatar.png" },
    });

    expect(within(dialog).getByRole("img")).toHaveAttribute("src", "https://example.com/avatar.png");
  });

  it("submits the updated name and avatar URL, and closes the dialog on success", async () => {
    const updated: UserProfile = { ...TEST_PROFILE, name: "New Name", avatarUrl: "https://example.com/a.png" };
    updateProfileMock.mockResolvedValue({ ok: true, data: updated });
    renderWithProviders(<EditProfileDialog profile={TEST_PROFILE} />);
    openDialog();

    fireEvent.change(screen.getByLabelText("Display Name"), { target: { value: "New Name" } });
    fireEvent.change(screen.getByLabelText("Avatar URL"), { target: { value: "https://example.com/a.png" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(updateProfileMock.mock.calls[0]?.[0]).toEqual({ name: "New Name", avatarUrl: "https://example.com/a.png" });
  });

  it("omits avatarUrl from the request entirely when the field is left blank (contract §2.3)", async () => {
    updateProfileMock.mockResolvedValue({ ok: true, data: TEST_PROFILE });
    renderWithProviders(<EditProfileDialog profile={TEST_PROFILE} />);
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(updateProfileMock).toHaveBeenCalledTimes(1));
    expect(updateProfileMock.mock.calls[0]?.[0]).toEqual({ name: TEST_PROFILE.name });
  });

  it("shows a generic alert and keeps the dialog open on an unexpected failure", async () => {
    updateProfileMock.mockResolvedValue({ ok: false, failure: { kind: "unexpected" } });
    renderWithProviders(<EditProfileDialog profile={TEST_PROFILE} />);
    const dialog = openDialog();

    fireEvent.click(within(dialog).getByRole("button", { name: "Save Changes" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Couldn't update your profile. Please try again."
    );
    expect(dialog).toBeInTheDocument();
  });
});
