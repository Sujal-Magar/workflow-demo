import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UserProfile } from "@workflow-demo/contracts";

import { createDeferred, renderWithProviders } from "@/test/render-with-providers";

import { exportData } from "../api/profile-api";
import type { ProfileResult } from "../lib/profile-error";
import { DataManagementActions } from "./data-management-actions";

vi.mock("../api/profile-api");

const exportDataMock = vi.mocked(exportData);

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

beforeEach(() => {
  // jsdom does not implement the Blob URL APIs the download path uses, and following a fake blob: href would log
  // a "navigation to another Document" error; stub both away for this test only.
  URL.createObjectURL = vi.fn(() => "blob:mock-url");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
});

afterEach(() => {
  exportDataMock.mockReset();
  vi.restoreAllMocks();
});

describe("T-UI-07 · DataManagementActions", () => {
  it("triggers the export mutation and shows the exact success toast", async () => {
    exportDataMock.mockResolvedValue({ ok: true, data: TEST_PROFILE });
    renderWithProviders(<DataManagementActions />);

    fireEvent.click(screen.getByRole("button", { name: "Export Data" }));

    await waitFor(() => expect(exportDataMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Your data has been exported successfully.")).toBeInTheDocument();
  });

  it("disables Export Data while the request is pending", async () => {
    const deferred = createDeferred<ProfileResult<UserProfile>>();
    exportDataMock.mockReturnValue(deferred.promise);
    renderWithProviders(<DataManagementActions />);

    fireEvent.click(screen.getByRole("button", { name: "Export Data" }));

    const button = screen.getByRole("button", { name: "Export Data" });
    await waitFor(() => expect(button).toBeDisabled());

    deferred.resolve({ ok: true, data: TEST_PROFILE });
    await waitFor(() => expect(button).toBeEnabled());
  });

  it("shows the failure toast when the export request fails", async () => {
    exportDataMock.mockResolvedValue({ ok: false, failure: { kind: "unexpected" } });
    renderWithProviders(<DataManagementActions />);

    fireEvent.click(screen.getByRole("button", { name: "Export Data" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't export your data. Please try again.");
  });

  it("renders the Clear All Data trigger alongside Export Data", () => {
    renderWithProviders(<DataManagementActions />);

    expect(screen.getByRole("button", { name: "Clear All Data" })).toBeInTheDocument();
  });
});
