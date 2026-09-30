import { test, expect, type Page } from "@playwright/test";

import {
  activeForm,
  AUTH_API_URL,
  expectDashboard,
  expectSignInView,
  newAccount,
  registerAccount,
  trackRequests,
  type TestAccount,
} from "./support/auth";

// T-UI-14 · Sign-in and session (AC6, AC7, AC10, REQ-AUTH-06).

const FRONTEND_ORIGIN = "http://localhost:3000";

async function signIn(page: Page, email: string, password: string): Promise<void> {
  const form = activeForm(page);
  await form.getByLabel("Email", { exact: true }).fill(email);
  await form.getByLabel("Password", { exact: true }).fill(password);
  await form.getByRole("button", { name: "SIGN IN", exact: true }).click();
}

async function signInAsNewAccount(page: Page, account: TestAccount): Promise<string> {
  await page.goto("/auth");
  await expectSignInView(page);
  const loginResponse = page.waitForResponse(
    (response) => response.url() === `${AUTH_API_URL}/login` && response.request().method() === "POST"
  );
  await signIn(page, account.email, account.password);
  const body = (await (await loginResponse).json()) as { accessToken: string };
  await expectDashboard(page, account.name);
  return body.accessToken;
}

async function readWebStorage(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const values: string[] = [];
    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key !== null) {
          values.push(`${key}=${storage.getItem(key) ?? ""}`);
        }
      }
    }
    return values;
  });
}

test.describe("T-UI-14 · sign-in and session", () => {
  test("happy path lands on /dashboard with an httpOnly refresh cookie and no token in Web Storage", async ({
    page,
    request,
  }) => {
    const account = newAccount("signin");
    await registerAccount(request, account);

    const accessToken = await signInAsNewAccount(page, account);

    const refreshCookie = (await page.context().cookies(AUTH_API_URL)).find(
      (cookie) => cookie.name === "refresh_token"
    );
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie?.httpOnly).toBe(true);
    expect(refreshCookie?.path).toBe("/api/v1/auth");
    expect(await page.evaluate(() => document.cookie)).not.toContain("refresh_token");
    const storedValues = await readWebStorage(page);
    expect(storedValues.some((value) => value.includes(accessToken))).toBe(false);
  });

  test("a wrong password and an unknown email both show exactly 'Invalid email or password'", async ({
    page,
    request,
  }) => {
    const account = newAccount("wrong-password");
    await registerAccount(request, account);
    const refreshRequests = trackRequests(page, "/refresh");
    await page.goto("/auth");
    await expectSignInView(page);
    const refreshesAfterRestore = refreshRequests.length;
    const alert = activeForm(page).getByRole("alert");

    await signIn(page, account.email, "Wr0ngPassword!");
    await expect(alert).toHaveText("Invalid email or password");
    const wrongPasswordText = await alert.textContent();

    await signIn(page, newAccount("unknown").email, account.password);
    await expect(alert).toHaveText("Invalid email or password");

    expect(await alert.textContent()).toBe(wrongPasswordText);
    await expect(page).toHaveURL(/\/auth$/);
    expect(refreshRequests.length).toBe(refreshesAfterRestore);
  });

  test("reloading /dashboard keeps the session and never visits /auth", async ({ page, request }) => {
    const account = newAccount("reload");
    await registerAccount(request, account);
    await signInAsNewAccount(page, account);
    const visitedUrls: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) {
        visitedUrls.push(frame.url());
      }
    });

    await page.reload();

    await expectDashboard(page, account.name);
    expect(visitedUrls.some((url) => new URL(url).pathname === "/auth")).toBe(false);
  });

  test("a /me call rejected with 401 UNAUTHENTICATED is refreshed, retried once and stays on /dashboard", async ({
    page,
    request,
  }) => {
    const account = newAccount("retry");
    await registerAccount(request, account);
    await signInAsNewAccount(page, account);
    const meRequests = trackRequests(page, "/me");
    const refreshRequests = trackRequests(page, "/refresh");
    let rejectedCount = 0;
    await page.route(`${AUTH_API_URL}/me`, async (route) => {
      if (route.request().method() !== "GET" || rejectedCount > 0) {
        await route.continue();
        return;
      }
      rejectedCount += 1;
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        headers: { "access-control-allow-origin": FRONTEND_ORIGIN, "access-control-allow-credentials": "true" },
        body: JSON.stringify({ code: "UNAUTHENTICATED", message: "Authentication required." }),
      });
    });

    await page.reload();
    await expectDashboard(page, account.name);

    await expect.poll(() => meRequests.length).toBe(2);
    expect(rejectedCount).toBe(1);
    // One refresh restores the session on reload; a second one follows the rejected /me.
    await expect.poll(() => refreshRequests.length).toBe(2);
    const retriedMe = await meRequests[1]?.response();
    expect(retriedMe?.status()).toBe(200);
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
