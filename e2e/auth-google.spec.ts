import { test, expect } from "@playwright/test";

import { appAlerts } from "./support/auth";

// T-UI-17 · Google (D-11): E2E runs with Google unconfigured on both servers (INT-07).

test.describe("T-UI-17 · Google sign-in with Google unconfigured", () => {
  test("the Google control is present on both panels", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in to FinTrack");
    await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();

    await page.getByRole("button", { name: "SIGN UP", exact: true }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Create Account");
    await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  });

  test.describe("clicking it shows the unavailable toast", () => {
    for (const mode of ["signin", "signup"] as const) {
      test(`on the ${mode} panel`, async ({ page }) => {
        await page.goto(`/auth?mode=${mode}`);

        await page.getByRole("button", { name: "Sign in with Google" }).click();

        await expect(appAlerts(page)).toHaveText("Google sign-in is unavailable.");
        await expect(page).toHaveURL(new RegExp(`/auth\\?mode=${mode}$`));
      });
    }
  });
});
