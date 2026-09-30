import { test, expect, type Page } from "@playwright/test";

import {
  activeForm,
  appAlerts,
  expectDashboard,
  newAccount,
  registerAccount,
  trackRequests,
  type TestAccount,
} from "./support/auth";

// T-UI-13 · Sign-up journeys (AC2–AC5).

interface SignUpInput {
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly confirmPassword: string;
}

function signUpInput(account: TestAccount, overrides: Partial<SignUpInput> = {}): SignUpInput {
  return { ...account, confirmPassword: account.password, ...overrides };
}

async function fillSignUp(page: Page, input: SignUpInput): Promise<void> {
  const form = activeForm(page);
  await form.getByLabel("Name", { exact: true }).fill(input.name);
  await form.getByLabel("Email", { exact: true }).fill(input.email);
  await form.getByLabel("Password", { exact: true }).fill(input.password);
  await form.getByLabel("Confirm Password", { exact: true }).fill(input.confirmPassword);
}

async function submitSignUp(page: Page): Promise<void> {
  await activeForm(page).getByRole("button", { name: "SIGN UP", exact: true }).click();
}

test.describe("T-UI-13 · sign-up journeys", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth?mode=signup");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Create Account");
  });

  test("happy path lands on /dashboard with the new user's name", async ({ page }) => {
    const account = newAccount("signup");
    await fillSignUp(page, signUpInput(account));

    await submitSignUp(page);

    await expectDashboard(page, account.name);
  });

  test("a duplicate email shows the email-exists toast and stays on Sign Up", async ({ page, request }) => {
    const account = newAccount("duplicate");
    await registerAccount(request, account);
    await fillSignUp(page, signUpInput(account, { email: account.email.toUpperCase() }));

    await submitSignUp(page);

    await expect(appAlerts(page)).toHaveText("An account with this email already exists.");
    await expect(page).toHaveURL(/\/auth\?mode=signup$/);
  });

  test("empty, weak and mismatched submissions show inline messages and send no request", async ({ page }) => {
    const signUpRequests = trackRequests(page, "/signup");
    const account = newAccount("invalid");

    await submitSignUp(page);
    await expect(page.getByText("Name is required.")).toBeVisible();
    await expect(page.getByText("Email is required.")).toBeVisible();
    await expect(page.getByText("Password is required.")).toBeVisible();
    await expect(page.getByText("Please confirm your password.")).toBeVisible();

    await fillSignUp(page, signUpInput(account, { password: "short1!", confirmPassword: "short1!" }));
    await submitSignUp(page);
    await expect(page.getByText("Password must be at least 8 characters.")).toBeVisible();

    await fillSignUp(page, signUpInput(account, { password: "abcdefgh!", confirmPassword: "abcdefgh!" }));
    await submitSignUp(page);
    await expect(page.getByText("Password must include a number.")).toBeVisible();

    await fillSignUp(page, signUpInput(account, { password: "abcdefg1", confirmPassword: "abcdefg1" }));
    await submitSignUp(page);
    await expect(page.getByText("Password must include a special character.")).toBeVisible();

    await fillSignUp(page, signUpInput(account, { confirmPassword: `${account.password}x` }));
    await submitSignUp(page);
    await expect(page.getByText("Passwords do not match.")).toBeVisible();

    await expect(page).toHaveURL(/\/auth\?mode=signup$/);
    expect(signUpRequests).toHaveLength(0);
  });

  test("a malformed email shows the inline message, no native tooltip blocks it, and no request is sent", async ({
    page,
  }) => {
    const signUpRequests = trackRequests(page, "/signup");
    const account = newAccount("malformed");
    await fillSignUp(page, signUpInput(account, { email: "user@" }));

    await submitSignUp(page);

    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    const emailInput = activeForm(page).getByLabel("Email", { exact: true });
    await expect(emailInput).toHaveAttribute("aria-invalid", "true");
    // The browser itself considers the value invalid, yet `noValidate` lets the app's own message show.
    expect(await emailInput.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false);
    expect(await emailInput.evaluate((input: HTMLInputElement) => input.form?.noValidate)).toBe(true);
    expect(signUpRequests).toHaveLength(0);
  });

  test("each eye toggle flips its own password field", async ({ page }) => {
    const form = activeForm(page);
    const password = form.getByLabel("Password", { exact: true });
    const confirmPassword = form.getByLabel("Confirm Password", { exact: true });
    const passwordToggle = form.getByRole("button", { name: "Show password" }).first();
    const confirmToggle = form.getByRole("button", { name: "Show password" }).last();
    await password.fill("Passw0rd!");
    await confirmPassword.fill("Passw0rd!");

    await passwordToggle.click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(confirmPassword).toHaveAttribute("type", "password");

    await confirmToggle.click();
    await expect(confirmPassword).toHaveAttribute("type", "text");

    await form.getByRole("button", { name: "Hide password" }).first().click();
    await expect(password).toHaveAttribute("type", "password");
    await expect(confirmPassword).toHaveAttribute("type", "text");
    await expect(page).toHaveURL(/\/auth\?mode=signup$/);
  });
});
