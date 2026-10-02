import { useQuery } from "@tanstack/react-query";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { UserProfile } from "@workflow-demo/contracts";

import { createDeferred, createTestQueryClient, renderWithProviders } from "@/test/render-with-providers";

import { updateProfile } from "../api/profile-api";
import { PROFILE_QUERY_KEY } from "../hooks/use-profile";
import type { ProfileResult } from "../lib/profile-error";
import { NotificationPreferencesList } from "./notification-preferences-list";

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
};

afterEach(() => {
  updateProfileMock.mockReset();
});

/** Mirrors how `PreferencesCard`/`ProfilePage` feed this list from the shared `["profile"]` query cache. */
function NotificationPreferencesHarness() {
  const { data } = useQuery<UserProfile>({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: () => Promise.reject(new Error("not used in this harness")),
    enabled: false,
  });
  if (!data) {
    return null;
  }
  return <NotificationPreferencesList notificationPreferences={data.notificationPreferences} />;
}

function renderHarness() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(PROFILE_QUERY_KEY, TEST_PROFILE);
  return renderWithProviders(<NotificationPreferencesHarness />, { queryClient });
}

describe("T-UI-06 · NotificationPreferencesList", () => {
  it("renders each preference as its own independently labelled checkbox", () => {
    renderHarness();

    expect(screen.getByRole("checkbox", { name: "Budget Limit Alerts" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Goal Reminders" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Weekly Summary Emails" })).toBeChecked();
  });

  it("toggles one preference without changing the others", async () => {
    updateProfileMock.mockResolvedValue({
      ok: true,
      data: {
        ...TEST_PROFILE,
        notificationPreferences: { budgetLimitAlerts: false, goalReminders: true, weeklySummaryEmails: true },
      },
    });
    renderHarness();

    fireEvent.click(screen.getByRole("checkbox", { name: "Budget Limit Alerts" }));

    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Budget Limit Alerts" })).not.toBeChecked());
    expect(screen.getByRole("checkbox", { name: "Goal Reminders" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Weekly Summary Emails" })).toBeChecked();
    expect(updateProfileMock.mock.calls[0]?.[0]).toEqual({ notificationPreferences: { budgetLimitAlerts: false } });
  });

  it("applies an optimistic update immediately, then rolls back and toasts on failure", async () => {
    const deferred = createDeferred<ProfileResult<UserProfile>>();
    updateProfileMock.mockReturnValue(deferred.promise);
    renderHarness();
    const checkbox = screen.getByRole("checkbox", { name: "Goal Reminders" });

    fireEvent.click(checkbox);

    await waitFor(() => expect(checkbox).not.toBeChecked());

    deferred.resolve({ ok: false, failure: { kind: "unexpected" } });

    await waitFor(() => expect(checkbox).toBeChecked());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't update your notification preference. Please try again."
    );
  });
});
