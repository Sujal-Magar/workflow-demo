// Renders a component inside the app's providers with a fake auth context, so form and page tests control the
// session state directly. The real `AuthProvider` is exercised by its own tests.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderResult } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { vi } from "vitest";

import type { PublicUser, SessionPayload } from "@workflow-demo/contracts";

import { ToastProvider } from "@/components/ui/toast";
import { GoogleAvailabilityProvider } from "@/features/auth/session/google-availability-provider";
import { AuthContext, type AuthContextValue } from "@/features/auth/session/use-auth";

export const TEST_USER: PublicUser = {
  id: "3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b",
  name: "Piyush Kumar",
  email: "piyush@example.com",
};

export const TEST_SESSION: SessionPayload = { user: TEST_USER, accessToken: "access-token-1", expiresIn: 900 };

export function createFakeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status: "unauthenticated",
    user: null,
    establishSession: vi.fn(),
    clearSession: vi.fn(),
    refreshSession: vi.fn().mockResolvedValue(false),
    expireSession: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

export function createTestQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

interface RenderOptions {
  readonly auth?: AuthContextValue;
  readonly googleClientId?: string | null;
  readonly queryClient?: QueryClient;
}

export interface RenderWithProvidersResult extends RenderResult {
  readonly auth: AuthContextValue;
  readonly queryClient: QueryClient;
}

export function renderWithProviders(ui: ReactElement, options: RenderOptions = {}): RenderWithProvidersResult {
  const auth = options.auth ?? createFakeAuth();
  const queryClient = options.queryClient ?? createTestQueryClient();
  const googleClientId = options.googleClientId ?? null;

  function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
    return (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <GoogleAvailabilityProvider clientId={googleClientId}>
            <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
          </GoogleAvailabilityProvider>
        </ToastProvider>
      </QueryClientProvider>
    );
  }

  const result: RenderResult = render(ui, { wrapper: Wrapper });
  return { ...result, auth, queryClient };
}

/** A promise whose settlement the test controls, to observe pending states. */
export function createDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
