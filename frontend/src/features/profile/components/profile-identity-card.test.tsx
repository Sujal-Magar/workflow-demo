import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { UserProfile } from "@workflow-demo/contracts";

import { renderWithProviders } from "@/test/render-with-providers";

import { ProfileIdentityCard } from "./profile-identity-card";

vi.mock("../api/profile-api");

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

describe("T-UI-02 · ProfileIdentityCard", () => {
  it("renders the Name/Email text and a placeholder avatar when avatarUrl is absent", () => {
    renderWithProviders(<ProfileIdentityCard profile={TEST_PROFILE} />);

    expect(screen.getByText(`Name: ${TEST_PROFILE.name}`)).toBeInTheDocument();
    expect(screen.getByText(`Email: ${TEST_PROFILE.email}`)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders an avatar image when avatarUrl is present", () => {
    const profile: UserProfile = { ...TEST_PROFILE, avatarUrl: "https://example.com/avatar.png" };
    renderWithProviders(<ProfileIdentityCard profile={profile} />);

    const image = screen.getByRole("img", { name: `${profile.name}'s avatar` });
    expect(image).toHaveAttribute("src", "https://example.com/avatar.png");
  });

  it("renders Edit Profile and Change Password buttons that each open their own dialog", async () => {
    renderWithProviders(<ProfileIdentityCard profile={TEST_PROFILE} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
    expect(await screen.findByRole("dialog", { name: "Edit Profile" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Change Password" }));
    expect(await screen.findByRole("dialog", { name: "Change Password" })).toBeInTheDocument();
  });
});
