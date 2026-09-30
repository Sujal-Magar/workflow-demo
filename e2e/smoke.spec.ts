import { test, expect } from "@playwright/test";

// T-UI-19: `/` now redirects (REQ-AUTH-07), so a signed-out visitor lands on the sign-in view.
test("homepage loads and lands a signed-out visitor on the sign-in view", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.locator("h1")).toHaveText("Sign in to FinTrack");
});
