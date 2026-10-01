import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test/render-with-providers";
import { resetNavigationMock } from "@/test/navigation-mock";

import { register } from "@/features/auth/api/auth-api";
import { SignUpForm } from "@/features/auth/components/sign-up-form";
import type { GoogleSignInControls } from "@/features/auth/hooks/use-google-sign-in";

import { PasswordInput } from "./password-input";

vi.mock("next/navigation", async () => (await import("@/test/navigation-mock")).nextNavigationMock);
vi.mock("@/features/auth/api/auth-api");

afterEach(() => {
  resetNavigationMock();
  vi.mocked(register).mockReset();
});

const GOOGLE_CONTROLS: GoogleSignInControls = {
  isPending: false,
  handleCredentialResponse: () => undefined,
  handleGoogleError: () => undefined,
  notifyUnavailable: () => undefined,
};

/** The eye toggle that belongs to the input labelled `label`. */
function toggleFor(label: string): HTMLElement {
  const input = screen.getByLabelText(label);
  return within(input.parentElement as HTMLElement).getByRole("button");
}

describe("T-UI-04 · PasswordInput", () => {
  it("starts masked and flips type, aria-label and aria-pressed on each toggle", () => {
    render(<PasswordInput label="Password" />);
    const input = screen.getByLabelText("Password");
    const toggle = screen.getByRole("button", { name: "Show password" });

    expect(input).toHaveAttribute("type", "password");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveAttribute("aria-controls", input.id);

    fireEvent.click(toggle);
    expect(input).toHaveAttribute("type", "text");
    expect(toggle).toHaveAccessibleName("Hide password");
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(toggle);
    expect(input).toHaveAttribute("type", "password");
    expect(toggle).toHaveAccessibleName("Show password");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles the sign-up Password and Confirm Password fields independently", () => {
    renderWithProviders(<SignUpForm isActive google={GOOGLE_CONTROLS} />);

    fireEvent.click(toggleFor("Password"));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Confirm Password")).toHaveAttribute("type", "password");

    fireEvent.click(toggleFor("Confirm Password"));
    fireEvent.click(toggleFor("Password"));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Confirm Password")).toHaveAttribute("type", "text");
  });

  it("does not submit the form it sits in", () => {
    const submitSpy = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={submitSpy}>
        <PasswordInput label="Password" />
      </form>
    );

    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle).toHaveAttribute("type", "button");
    fireEvent.click(toggle);

    expect(submitSpy).not.toHaveBeenCalled();
  });

  it("does not submit the sign-up form or trigger validation", () => {
    renderWithProviders(<SignUpForm isActive google={GOOGLE_CONTROLS} />);

    fireEvent.click(toggleFor("Password"));

    expect(screen.queryByText("Name is required.")).not.toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });
});
