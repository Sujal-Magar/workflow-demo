import { test, expect } from "@playwright/test";

import { newAccount, registerAccount } from "./support/auth";
import { gotoProfile } from "./support/profile";

// T-UI-11 · Profile export data (FE-07, INT-01; behavior.md §4).

test.describe("T-UI-11 · profile export data", () => {
  test("clicking Export Data downloads the archive and shows the exact success toast", async ({ page }) => {
    const account = newAccount("export-data");
    await registerAccount(page.request, account);
    await gotoProfile(page);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export Data" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^profile-export-\d{4}-\d{2}-\d{2}\.json$/);
    await expect(page.getByText("Your data has been exported successfully.")).toBeVisible();
  });
});
