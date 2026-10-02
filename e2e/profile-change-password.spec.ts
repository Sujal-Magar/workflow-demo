import { test, expect, type Page } from "@playwright/test";

import { newAccount, registerAccount, TEST_PASSWORD, type TestAccount } from "./support/auth";
import { gotoProfile } from "./support/profile";

// T-UI-09 · Profile change password (FE-05, INT-01; behavior.md §2).

const NEW_PASSWORD = "N3wPassw0rd!";

async function openChangePasswordDialog(page: Page) {
  await page.getByRole("button", { name: "Change Password" }).click();
  const dialog = page.getByRole("dialog", { name: "Change Password" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function registerAndOpen(page: Page, label: string): Promise<TestAccount> {
  const account = newAccount(label);
  await registerAccount(page.request, account);
  await gotoProfile(page);
  return account;
}

test.describe("T-UI-09 · profile change password", () => {
  test("the happy path updates the password, toasts and closes the dialog", async ({ page }) => {
    await registerAndOpen(page, "change-pw-happy");
    const dialog = await openChangePasswordDialog(page);

    await dialog.getByLabel("Current Password").fill(TEST_PASSWORD);
    await dialog.getByLabel("New Password", { exact: true }).fill(NEW_PASSWORD);
    await dialog.getByLabel("Confirm New Password").fill(NEW_PASSWORD);
    await dialog.getByRole("button", { name: "Change Password" }).click();

    await expect(page.getByText("Password updated successfully!")).toBeVisible();
    await expect(dialog).toBeHidden();
  });

  test("an incorrect current password shows the exact inline error", async ({ page }) => {
    await registerAndOpen(page, "change-pw-wrong");
    const dialog = await openChangePasswordDialog(page);

    await dialog.getByLabel("Current Password").fill("WrongPassw0rd!");
    await dialog.getByLabel("New Password", { exact: true }).fill(NEW_PASSWORD);
    await dialog.getByLabel("Confirm New Password").fill(NEW_PASSWORD);
    await dialog.getByRole("button", { name: "Change Password" }).click();

    await expect(dialog.getByText("Incorrect current password.")).toBeVisible();
  });

  test("weak new passwords are rejected inline before any request is sent", async ({ page }) => {
    await registerAndOpen(page, "change-pw-weak");
    const dialog = await openChangePasswordDialog(page);

    await dialog.getByLabel("Current Password").fill(TEST_PASSWORD);
    await dialog.getByLabel("New Password", { exact: true }).fill("short");
    await dialog.getByLabel("Confirm New Password").fill("short");
    await dialog.getByRole("button", { name: "Change Password" }).click();

    await expect(dialog.getByText("Password must be at least 8 characters.")).toBeVisible();
  });

  test("a mismatched confirmation shows the exact inline error (server-driven, D-07)", async ({ page }) => {
    await registerAndOpen(page, "change-pw-mismatch");
    const dialog = await openChangePasswordDialog(page);

    await dialog.getByLabel("Current Password").fill(TEST_PASSWORD);
    await dialog.getByLabel("New Password", { exact: true }).fill(NEW_PASSWORD);
    await dialog.getByLabel("Confirm New Password").fill("Different1!");
    await dialog.getByRole("button", { name: "Change Password" }).click();

    await expect(dialog.getByText("New password and confirmation do not match.")).toBeVisible();
  });
});
