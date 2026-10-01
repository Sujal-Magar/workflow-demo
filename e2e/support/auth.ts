import { expect, type APIRequestContext, type Locator, type Page, type Request } from "@playwright/test";

/** Matches `playwright.config.ts` (INT-07): the backend runs on this origin with `data/e2e-test.db`. */
export const AUTH_API_URL = "http://localhost:4000/api/v1/auth";
export const TEST_PASSWORD = "Passw0rd!";
export const TEST_NAME = "E2E Tester";

export interface TestAccount {
  readonly name: string;
  readonly email: string;
  readonly password: string;
}

/** Every test uses its own email, so runs never depend on the state left in the E2E database. */
export function uniqueEmail(label: string): string {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `e2e-${label}-${suffix}@example.com`;
}

export function newAccount(label: string): TestAccount {
  return { name: TEST_NAME, email: uniqueEmail(label), password: TEST_PASSWORD };
}

/**
 * Registers an account through the API. With `page.request` the refresh cookie lands in the page's browser context
 * (signed in); with the standalone `request` fixture the browser stays signed out.
 */
export async function registerAccount(request: APIRequestContext, account: TestAccount): Promise<void> {
  const response = await request.post(`${AUTH_API_URL}/signup`, {
    data: { ...account, confirmPassword: account.password },
  });
  expect(response.status()).toBe(201);
}

/** Records every browser request whose URL ends with `path` (for "no request was sent" assertions). */
export function trackRequests(page: Page, path: string): Request[] {
  const requests: Request[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === `/api/v1/auth${path}` && request.method() !== "OPTIONS") {
      requests.push(request);
    }
  });
  return requests;
}

export async function expectSignInView(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/auth(\?mode=signin)?$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in to FinTrack");
}

export async function expectDashboard(page: Page, name: string): Promise<void> {
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Signed in as ${name}`);
}

/**
 * Visible alerts raised by the app (toasts and inline form alerts). Next's route announcer also has `role="alert"`,
 * so it is excluded.
 */
export function appAlerts(page: Page): Locator {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}

/** The visible auth form: both forms stay mounted, and only the active one's title is the `h1`. */
export function activeForm(page: Page): Locator {
  return page.locator("form").filter({ has: page.locator("h1") });
}
