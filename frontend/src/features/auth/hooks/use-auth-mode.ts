"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export type AuthMode = "signin" | "signup";

export const AUTH_MODE_PARAM = "mode";

/** `signup` only when requested explicitly; missing or unrecognized values mean `signin`. */
export function parseAuthMode(value: string | null): AuthMode {
  return value === "signup" ? "signup" : "signin";
}

export function useAuthMode(): { mode: AuthMode; switchMode: (next: AuthMode) => void } {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mode = parseAuthMode(searchParams.get(AUTH_MODE_PARAM));

  const switchMode = useCallback(
    (next: AuthMode) => {
      // Push (not replace) so the browser Back button returns to the previous view.
      router.push(`/auth?${AUTH_MODE_PARAM}=${next}`, { scroll: false });
    },
    [router]
  );

  return { mode, switchMode };
}
