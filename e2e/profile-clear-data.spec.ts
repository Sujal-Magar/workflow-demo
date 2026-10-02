import { test, expect } from "@playwright/test";

import { newAccount, registerAccount } from "./support/auth";
import { gotoProfile } from "./support/profile";

// T-UI-12 · Profile clear all data (FE-07, INT-01; behavior.md §5).

// A same-document data: URI so the <img> loads without any network access (D-03: avatarUrl is an arbitrary string,
// not validated as a reachable URL), avoiding flakiness from a real external host in a sandboxed test run.
const AVATAR_DATA_URI = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";

test.describe("T-UI-12 · profile clear all data", () => {
  test("requires typing DELETE to confirm, shows the exact success toast, and keeps the account signed in", async ({
    page,
  }) => {
    const account = newAccount("clear-data");
    await registerAccount(page.request, account);
    await gotoProfile(page);
    // Give the account a non-default avatar and a flipped preference so the reset is observable.
    await page.getByRole("button", { name: "Edit Profile" }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit Profile" });
    await editDialog.getByLabel("Avatar URL").fill(AVATAR_DATA_URI);
    await editDialog.getByRole("button", { name: "Save Changes" }).click();
    await expect(editDialog).toBeHidden();
    await expect(page.getByRole("img", { name: `${account.name}'s avatar` })).toHaveAttribute("src", AVATAR_DATA_URI);
    await page.getByRole("checkbox", { name: "Goal Reminders" }).click();
    await expect(page.getByRole("checkbox", { name: "Goal Reminders" })).not.toBeChecked();

    await page.getByRole("button", { name: "Clear All Data" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    const confirmButton = dialog.getByRole("button", { name: "Clear All Data" });
    await expect(confirmButton).toBeDisabled();

    await dialog.getByLabel("Type DELETE to confirm").fill("DELETE");
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    await expect(page.getByText("All profile data has been cleared.")).toBeVisible();
    await expect(dialog).toBeHidden();

    // Only the warned-about data (avatar + notification preferences) reset; identity and session are untouched.
    await expect(page.getByText(`Name: ${account.name}`)).toBeVisible();
    await expect(page.getByText(`Email: ${account.email}`)).toBeVisible();
    await expect(page.getByRole("img", { name: `${account.name}'s avatar` })).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: "Goal Reminders" })).toBeChecked();

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "My Profile" })).toBeVisible();
    await expect(page.getByText(`Name: ${account.name}`)).toBeVisible();
  });
});
