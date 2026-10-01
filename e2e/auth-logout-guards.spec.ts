import { test, expect } from "@playwright/test";

import { AUTH_API_URL, expectDashboard, expectSignInView, newAccount, registerAccount } from "./support/auth";

// T-UI-15 · Logout and guards (AC13, AC14).

test.describe("T-UI-15 · logout and guards", () => {
  test("Sign out goes to /auth, and /dashboard afterwards (and a reload) stays signed out", async ({ page }) => {
    const account = newAccount("logout");
    // `page.request` shares the browser context, so the refresh cookie from sign-up signs the browser in.
    await registerAccount(page.request, account);
    await page.goto("/dashboard");
    await expectDashboard(page, account.name);

    await page.getByRole("button", { name: "Sign out" }).click();

    await expectSignInView(page);
    const cookies = await page.context().cookies(AUTH_API_URL);
    expect(cookies.find((cookie) => cookie.name === "refresh_token")).toBeUndefined();

    await page.goto("/dashboard");
    await expectSignInView(page);

    await page.reload();
    await expectSignInView(page);
  });

  for (const path of ["/dashboard", "/"]) {
    test(`a signed-out visit to ${path} redirects to /auth`, async ({ page }) => {
      await page.goto(path);

      await expectSignInView(page);
    });
  }

  test("a signed-in visit to /auth redirects to /dashboard", async ({ page }) => {
    const account = newAccount("guest-guard");
    await registerAccount(page.request, account);

    await page.goto("/auth");

    await expectDashboard(page, account.name);
  });

  test("a signed-in visit to / redirects to /dashboard", async ({ page }) => {
    const account = newAccount("root");
    await registerAccount(page.request, account);

    await page.goto("/");

    await expectDashboard(page, account.name);
  });
});
