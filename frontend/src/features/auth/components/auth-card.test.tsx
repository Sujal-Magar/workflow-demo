import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test/render-with-providers";
import { resetNavigationMock, routerMock, setSearchParams } from "@/test/navigation-mock";

import { parseAuthMode } from "../hooks/use-auth-mode";
import { AuthCard } from "./auth-card";

vi.mock("next/navigation", async () => (await import("@/test/navigation-mock")).nextNavigationMock);
vi.mock("@react-oauth/google", async () => (await import("@/test/google-oauth-mock")).googleOAuthMock);
vi.mock("@/features/auth/api/auth-api");

afterEach(() => {
  resetNavigationMock();
});

function activeHeading(): HTMLElement {
  return screen.getByRole("heading", { level: 1 });
}

/** The form panel wrapping the form whose title is `title` (both forms stay mounted). */
function panelOf(title: string): HTMLElement {
  const heading = screen.getByText(title, { selector: "h1, h2" });
  const panel = heading.closest("form")?.parentElement;
  if (!panel) {
    throw new Error(`No panel found for ${title}`);
  }
  return panel;
}

describe("T-UI-01 · AuthCard mode handling", () => {
  it.each([
    ["missing", ""],
    ["unknown", "mode=register"],
    ["signin", "mode=signin"],
  ])("shows Sign In when mode is %s", (_label, query) => {
    setSearchParams(query);
    renderWithProviders(<AuthCard />);

    expect(activeHeading()).toHaveTextContent("Sign in to FinTrack");
  });

  it("shows Sign Up when mode=signup", () => {
    setSearchParams("mode=signup");
    renderWithProviders(<AuthCard />);

    expect(activeHeading()).toHaveTextContent("Create Account");
  });

  it("parses only `signup` as the sign-up mode", () => {
    expect(parseAuthMode(null)).toBe("signin");
    expect(parseAuthMode("SIGNUP")).toBe("signin");
    expect(parseAuthMode("signup")).toBe("signup");
  });

  it("shows the sign-up invitation in signin mode and pushes ?mode=signup", () => {
    renderWithProviders(<AuthCard />);

    expect(screen.getByText("Hello, Friend!")).toBeVisible();
    expect(screen.getByText("Enter your personal details and start journey with us")).toBeInTheDocument();
    const invitation = screen.getByText("Hello, Friend!").parentElement as HTMLElement;
    expect(invitation).not.toHaveAttribute("aria-hidden");
    fireEvent.click(within(invitation).getByRole("button", { name: "SIGN UP" }));

    expect(routerMock.push).toHaveBeenCalledWith("/auth?mode=signup", { scroll: false });
  });

  it("shows the sign-in invitation in signup mode and pushes ?mode=signin", () => {
    setSearchParams("mode=signup");
    renderWithProviders(<AuthCard />);

    const invitation = screen.getByText("Welcome Back!").parentElement as HTMLElement;
    expect(invitation).not.toHaveAttribute("aria-hidden");
    expect(within(invitation).getByText("Log in to manage your finances.")).toBeInTheDocument();
    expect(screen.getByText("Hello, Friend!").parentElement).toHaveAttribute("aria-hidden", "true");
    fireEvent.click(within(invitation).getByRole("button", { name: "SIGN IN" }));

    expect(routerMock.push).toHaveBeenCalledWith("/auth?mode=signin", { scroll: false });
  });

  it("marks the hidden form panel aria-hidden and inert", async () => {
    renderWithProviders(<AuthCard />);

    const signUpPanel = panelOf("Create Account");
    const signInPanel = panelOf("Sign in to FinTrack");
    expect(signUpPanel).toHaveAttribute("aria-hidden", "true");
    await waitFor(() => expect(signUpPanel.inert).toBe(true));
    expect(signInPanel).not.toHaveAttribute("aria-hidden");
    expect(signInPanel.inert).toBe(false);
  });

  it("clears the hidden form's values and errors when the mode changes", async () => {
    setSearchParams("mode=signup");
    const { rerender } = renderWithProviders(<AuthCard />);
    const signUpPanel = panelOf("Create Account");

    fireEvent.change(within(signUpPanel).getByLabelText("Name"), { target: { value: "Piyush" } });
    fireEvent.click(within(signUpPanel).getByRole("button", { name: "SIGN UP" }));
    expect(await within(signUpPanel).findByText("Email is required.")).toBeInTheDocument();

    setSearchParams("mode=signin");
    rerender(<AuthCard />);

    await waitFor(() => expect(within(signUpPanel).getByLabelText("Name")).toHaveValue(""));
    expect(within(signUpPanel).queryByText("Email is required.")).not.toBeInTheDocument();
    expect(activeHeading()).toHaveTextContent("Sign in to FinTrack");
    await waitFor(() => expect(signUpPanel.inert).toBe(true));
  });

  it("clears the sign-in form, its alert and errors when switching to sign up", async () => {
    const { rerender } = renderWithProviders(<AuthCard />);
    const signInPanel = panelOf("Sign in to FinTrack");

    fireEvent.change(within(signInPanel).getByLabelText("Email"), { target: { value: "not-an-email" } });
    fireEvent.click(within(signInPanel).getByRole("button", { name: "SIGN IN" }));
    expect(await within(signInPanel).findByText("Enter a valid email address.")).toBeInTheDocument();

    setSearchParams("mode=signup");
    rerender(<AuthCard />);

    await waitFor(() => expect(within(signInPanel).getByLabelText("Email")).toHaveValue(""));
    expect(within(signInPanel).queryByText("Enter a valid email address.")).not.toBeInTheDocument();
  });
});
