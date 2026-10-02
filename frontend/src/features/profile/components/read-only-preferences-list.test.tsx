import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { UserProfile } from "@workflow-demo/contracts";

import { ReadOnlyPreferencesList } from "./read-only-preferences-list";

const BASE_PROFILE: UserProfile = {
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

describe("T-UI-05 · ReadOnlyPreferencesList", () => {
  it("renders Preferred Currency, Language and Monthly Start Date in the specified format", () => {
    render(<ReadOnlyPreferencesList profile={BASE_PROFILE} />);

    expect(screen.getByText("Preferred Currency:")).toBeInTheDocument();
    expect(screen.getByText("NPR (₹)")).toBeInTheDocument();
    expect(screen.getByText("Language:")).toBeInTheDocument();
    expect(screen.getByText("English (EN)")).toBeInTheDocument();
    expect(screen.getByText("Monthly Start Date:")).toBeInTheDocument();
    expect(screen.getByText("1st of every month")).toBeInTheDocument();
  });

  it.each<[number, string]>([
    [2, "2nd of every month"],
    [3, "3rd of every month"],
    [4, "4th of every month"],
    [11, "11th of every month"],
    [12, "12th of every month"],
    [13, "13th of every month"],
    [21, "21st of every month"],
    [22, "22nd of every month"],
    [23, "23rd of every month"],
    [31, "31st of every month"],
  ])("formats monthlyStartDate %i as '%s'", (monthlyStartDate, expected) => {
    render(<ReadOnlyPreferencesList profile={{ ...BASE_PROFILE, monthlyStartDate }} />);

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("renders no inputs or edit affordances in v1.0.0 (REQ-PROF-02)", () => {
    render(<ReadOnlyPreferencesList profile={BASE_PROFILE} />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
