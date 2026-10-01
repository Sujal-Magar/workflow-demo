// Controllable stand-in for `next/navigation` (plan §8.2). Test files install it with
// `vi.mock("next/navigation", async () => (await import("@/test/navigation-mock")).nextNavigationMock)`.
import { vi } from "vitest";

export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

let currentSearchParams = new URLSearchParams();
let pendingSuspension: Promise<void> | null = null;

export function setSearchParams(query: string): void {
  currentSearchParams = new URLSearchParams(query);
}

/** Makes `useSearchParams` suspend until the returned function is called, to exercise Suspense fallbacks. */
export function suspendSearchParams(): () => void {
  let release: () => void = () => undefined;
  pendingSuspension = new Promise<void>((resolve) => {
    release = () => {
      pendingSuspension = null;
      resolve();
    };
  });
  return release;
}

export function resetNavigationMock(): void {
  Object.values(routerMock).forEach((mockFunction) => mockFunction.mockReset());
  currentSearchParams = new URLSearchParams();
  pendingSuspension = null;
}

function useSearchParams(): URLSearchParams {
  if (pendingSuspension) {
    throw pendingSuspension;
  }
  return currentSearchParams;
}

export const nextNavigationMock = {
  useRouter: () => routerMock,
  useSearchParams,
  usePathname: () => "/",
};
