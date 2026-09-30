import { test, expect, type Page } from "@playwright/test";

import { activeForm, expectSignInView, newAccount, registerAccount, trackRequests } from "./support/auth";

// T-UI-16 · Password reset, browser-reachable parts (AC11, REQ-AUTH-05, D-10).

const INVALID_LINK_MESSAGE = "This reset link is invalid or has expired.";

async function requestResetLink(page: Page, email: string): Promise<string> {
  await activeForm(page).getByRole("button", { name: "Forgot your password?" }).click();
  const dialog = page.getByRole("dialog", { name: "Reset your password" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Email", { exact: true }).fill(email);
  await dialog.getByRole("button", { name: "SEND RESET LINK" }).click();
  const message = dialog.getByRole("status");
  await expect(message).toBeVisible();
  const text = (await message.textContent()) ?? "";
  await dialog.getByRole("button", { name: "BACK TO SIGN IN" }).click();
  await expect(dialog).toBeHidden();
  return text;
}

async function expectInvalidLinkWithWorkingAuthLink(page: Page): Promise<void> {
  await expect(page.getByText(INVALID_LINK_MESSAGE)).toBeVisible();
  await page.getByRole("link", { name: "BACK TO SIGN IN" }).click();
  await expectSignInView(page);
}

test.describe("T-UI-16 · password reset", () => {
  test("the dialog shows the same generic message for a registered and an unregistered email", async ({
    page,
    request,
  }) => {
    const account = newAccount("reset-registered");
    await registerAccount(request, account);
    await page.goto("/auth");
    await expectSignInView(page);

    const registeredMessage = await requestResetLink(page, account.email);
    const unregisteredMessage = await requestResetLink(page, newAccount("reset-unknown").email);

    expect(registeredMessage).toBe("If an account exists for that email, a reset link has been sent.");
    expect(unregisteredMessage).toBe(registeredMessage);
  });

  test("Escape closes the dialog and returns focus to the link", async ({ page }) => {
    await page.goto("/auth");
    await expectSignInView(page);
    const link = activeForm(page).getByRole("button", { name: "Forgot your password?" });
    await link.click();
    const dialog = page.getByRole("dialog", { name: "Reset your password" });
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(dialog).toBeHidden();
    await expect(link).toBeFocused();
  });

  test("/reset-password without a token shows the invalid-link message with a working /auth link", async ({ page }) => {
    const resetRequests = trackRequests(page, "/reset-password");

    await page.goto("/reset-password");

    await expect(page.getByLabel("New Password", { exact: true })).toHaveCount(0);
    expect(resetRequests).toHaveLength(0);
    await expectInvalidLinkWithWorkingAuthLink(page);
  });

  test("?token=bogus shows the invalid-link message after submitting valid passwords", async ({ page }) => {
    const resetRequests = trackRequests(page, "/reset-password");
    await page.goto("/reset-password?token=bogus");
    await page.getByLabel("New Password", { exact: true }).fill("N3wPassw0rd!");
    await page.getByLabel("Confirm New Password", { exact: true }).fill("N3wPassw0rd!");

    await page.getByRole("button", { name: "RESET PASSWORD" }).click();

    await expect(page.getByText(INVALID_LINK_MESSAGE)).toBeVisible();
    expect(resetRequests).toHaveLength(1);
    await expectInvalidLinkWithWorkingAuthLink(page);
  });
});
