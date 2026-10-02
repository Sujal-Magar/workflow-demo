import { test, expect } from "@playwright/test";

import { newAccount, registerAccount } from "./support/auth";
import { gotoProfile } from "./support/profile";

// T-UI-10 · Profile notification preferences (FE-06, INT-01; behavior.md §3).

const PREFERENCE_LABELS = ["Budget Limit Alerts", "Goal Reminders", "Weekly Summary Emails"] as const;

test.describe("T-UI-10 · profile notifications", () => {
  test("toggling each notification checkbox independently persists across a reload", async ({ page }) => {
    const account = newAccount("notifications");
    await registerAccount(page.request, account);
    await gotoProfile(page);

    for (const label of PREFERENCE_LABELS) {
      await expect(page.getByRole("checkbox", { name: label })).toBeChecked();
    }

    // Uncheck only Goal Reminders; the other two must stay untouched.
    await page.getByRole("checkbox", { name: "Goal Reminders" }).click();
    await expect(page.getByRole("checkbox", { name: "Goal Reminders" })).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Budget Limit Alerts" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Weekly Summary Emails" })).toBeChecked();

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "My Profile" })).toBeVisible();

    await expect(page.getByRole("checkbox", { name: "Goal Reminders" })).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Budget Limit Alerts" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Weekly Summary Emails" })).toBeChecked();

    // Toggle it back on and reload again to confirm the write round-trips in both directions.
    await page.getByRole("checkbox", { name: "Goal Reminders" }).click();
    await expect(page.getByRole("checkbox", { name: "Goal Reminders" })).toBeChecked();

    await page.reload();
    await expect(page.getByRole("checkbox", { name: "Goal Reminders" })).toBeChecked();
  });
});
