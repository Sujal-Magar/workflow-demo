import { expect, type Page } from "@playwright/test";

/** Navigates directly to `/profile` (D-13: no shared nav header is built by `profile` v1.0.0). */
export async function gotoProfile(page: Page): Promise<void> {
  await page.goto("/profile");
  await expect(page.getByRole("heading", { level: 1, name: "My Profile" })).toBeVisible();
}
