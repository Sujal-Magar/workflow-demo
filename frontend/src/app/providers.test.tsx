import { useQueryClient } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useToast } from "@/components/ui/toast";
import { refreshSession } from "@/features/auth/api/auth-api";
import { useGoogleAvailability } from "@/features/auth/session/google-availability-provider";
import { useAuth } from "@/features/auth/session/use-auth";
import { resetNavigationMock } from "@/test/navigation-mock";

import { Providers } from "./providers";

vi.mock("next/navigation", async () => (await import("@/test/navigation-mock")).nextNavigationMock);
vi.mock("@react-oauth/google", async () => (await import("@/test/google-oauth-mock")).googleOAuthMock);
vi.mock("@/features/auth/api/auth-api");

afterEach(() => {
  resetNavigationMock();
  vi.mocked(refreshSession).mockReset();
});

function ContextProbe() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { isAvailable } = useGoogleAvailability();
  const { status } = useAuth();
  return (
    <dl data-testid="probe">
      <dt>query client</dt>
      <dd>{String(Boolean(queryClient.getQueryCache()))}</dd>
      <dt>toast</dt>
      <dd>{String(typeof toast.error === "function")}</dd>
      <dt>google</dt>
      <dd data-testid="google">{String(isAvailable)}</dd>
      <dt>auth</dt>
      <dd data-testid="auth-status">{status}</dd>
    </dl>
  );
}

describe("T-UI-20 · app/providers", () => {
  it("renders its children", async () => {
    // Resolved (not left pending) so the single-flight refresh does not carry over into the next test.
    vi.mocked(refreshSession).mockResolvedValue({ ok: false, failure: { kind: "unauthenticated" } });
    render(<Providers>child content</Providers>);

    expect(screen.getByText("child content")).toBeInTheDocument();
    await waitFor(() => expect(refreshSession).toHaveBeenCalledTimes(1));
  });

  it("gives children the QueryClient, toast, Google availability and auth contexts, with Auth innermost", async () => {
    vi.mocked(refreshSession).mockResolvedValue({ ok: false, failure: { kind: "unauthenticated" } });
    render(
      <Providers>
        <ContextProbe />
      </Providers>
    );

    // AuthProvider reads the QueryClient and runs the restore, so it sits inside the QueryClient provider.
    await waitFor(() => expect(screen.getByTestId("auth-status")).toHaveTextContent(/^unauthenticated$/));
    expect(screen.getAllByText("true")).toHaveLength(2);
    // No client ID is configured in tests, so Google is unavailable.
    expect(screen.getByTestId("google")).toHaveTextContent("false");
    // The toast viewport is rendered by ToastProvider next to the subtree it wraps.
    const liveRegion = document.querySelector("[aria-live]");
    expect(liveRegion?.parentElement).toBe(screen.getByTestId("probe").parentElement);
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });
});
