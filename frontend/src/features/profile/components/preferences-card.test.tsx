import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { UserProfile } from "@workflow-demo/contracts";

import { renderWithProviders } from "@/test/render-with-providers";

import { PreferencesCard } from "./preferences-card";

vi.mock("../api/profile-api");

const TEST_PROFILE: UserProfile = {
  id: "user-1",
  name: "Piyush Kumar",
  email: "piyush@example.com",
  avatarUrl: null,
  preferredCurrency: "NPR",
  language: "en_US",
  monthlyStartDate: 1,
  notificationPreferences: { budgetLimitAlerts: true, goalReminders: false, weeklySummaryEmails: true },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("T-UI-05 · PreferencesCard", () => {
  it("renders the read-only preferences, the notification toggles and the data-management actions together", () => {
    renderWithProviders(<PreferencesCard profile={TEST_PROFILE} />);

    expect(screen.getByText("NPR (₹)")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Budget Limit Alerts" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Goal Reminders" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Weekly Summary Emails" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Export Data" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear All Data" })).toBeInTheDocument();
  });
});
