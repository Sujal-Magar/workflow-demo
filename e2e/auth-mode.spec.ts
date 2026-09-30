import { test, expect, type Page } from "@playwright/test";

import { expectSignInView } from "./support/auth";

// T-UI-12 · Mode and URL (AC1, behavior §1–2).

/** Sets a marker on `window` that only survives while no full page reload happens. */
async function markDocument(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as Window & { e2eMarker?: string }).e2eMarker = "same-document";
  });
}

async function readMarker(page: Page): Promise<string | undefined> {
  return page.evaluate(() => (window as Window & { e2eMarker?: string }).e2eMarker);
}

test.describe("T-UI-12 · auth mode and URL", () => {
  test("/auth shows Sign In by default", async ({ page }) => {
    await page.goto("/auth");

    await expectSignInView(page);
    await expect(page.getByText("Hello, Friend!")).toBeVisible();
  });

  test("SIGN UP switches to ?mode=signup without a reload, and Back returns to Sign In with fields cleared", async ({
    page,
  }) => {
    await page.goto("/auth");
    await expectSignInView(page);
    const signInEmail = page.getByRole("textbox", { name: "Email" });
    await signInEmail.fill("typed-before-switch@example.com");
    await markDocument(page);

    await page.getByRole("button", { name: "SIGN UP", exact: true }).click();

    await expect(page).toHaveURL(/\/auth\?mode=signup$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Create Account");
    await expect(page.getByText("Welcome Back!")).toBeVisible();
    expect(await readMarker(page)).toBe("same-document");
    await page.getByRole("textbox", { name: "Name" }).fill("Typed Name");

    await page.goBack();

    await expect(page).toHaveURL(/\/auth$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in to FinTrack");
    await expect(page.getByRole("textbox", { name: "Email" })).toHaveValue("");
    expect(await readMarker(page)).toBe("same-document");

    await page.goForward();

    await expect(page).toHaveURL(/\/auth\?mode=signup$/);
    await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue("");
  });

  test("a deep link to ?mode=signup opens Sign Up, and SIGN IN switches back", async ({ page }) => {
    await page.goto("/auth?mode=signup");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Create Account");
    await page.getByRole("button", { name: "SIGN IN", exact: true }).click();

    await expect(page).toHaveURL(/\/auth\?mode=signin$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in to FinTrack");
  });

  test("an unrecognized mode falls back to Sign In", async ({ page }) => {
    await page.goto("/auth?mode=bogus");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in to FinTrack");
  });
});
