import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { UserProfile } from "@workflow-demo/contracts";

import { createDeferred, renderWithProviders } from "@/test/render-with-providers";

import { getProfile } from "../api/profile-api";
import type { ProfileResult } from "../lib/profile-error";
import { ProfilePage } from "./profile-page";

vi.mock("../api/profile-api");

const getProfileMock = vi.mocked(getProfile);

const TEST_PROFILE: UserProfile = {
  id: "user-1",
  name: "Piyush Kumar",
  email: "piyush@example.com",
  avatarUrl: null,
  preferredCurrency: "NPR",
  language: "en_US",
  monthlyStartDate: 1,
  notificationPreferences: { budgetLimitAlerts: true, goalReminders: true, weeklySummaryEmails: true },
};

afterEach(() => {
  getProfileMock.mockReset();
});

describe("T-UI-01 · ProfilePage", () => {
  it("renders the 'My Profile' heading and a loading skeleton while the profile query is pending", () => {
    getProfileMock.mockReturnValue(createDeferred<ProfileResult<UserProfile>>().promise);

    const { container } = renderWithProviders(<ProfilePage />);

    expect(screen.getByRole("heading", { level: 1, name: "My Profile" })).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryByText(`Name: ${TEST_PROFILE.name}`)).not.toBeInTheDocument();
  });

  it("renders both cards once useProfile resolves", async () => {
    getProfileMock.mockResolvedValue({ ok: true, data: TEST_PROFILE });

    renderWithProviders(<ProfilePage />);

    expect(await screen.findByText(`Name: ${TEST_PROFILE.name}`)).toBeInTheDocument();
    expect(screen.getByText(`Email: ${TEST_PROFILE.email}`)).toBeInTheDocument();
    expect(screen.getByText("NPR (₹)")).toBeInTheDocument();
    expect(screen.getByText("English (EN)")).toBeInTheDocument();
    expect(screen.getByText("1st of every month")).toBeInTheDocument();
  });

  it("shows a page-level error state with a Retry affordance on query failure, and retries on click", async () => {
    getProfileMock.mockResolvedValue({ ok: false, failure: { kind: "unexpected" } });

    renderWithProviders(<ProfilePage />);

    expect(await screen.findByText("Couldn't load your profile. Please try again.")).toBeInTheDocument();
    expect(screen.queryByText(`Name: ${TEST_PROFILE.name}`)).not.toBeInTheDocument();

    getProfileMock.mockResolvedValue({ ok: true, data: TEST_PROFILE });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText(`Name: ${TEST_PROFILE.name}`)).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load your profile. Please try again.")).not.toBeInTheDocument();
  });
});
