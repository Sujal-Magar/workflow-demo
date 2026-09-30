"use client";

import { useQuery } from "@tanstack/react-query";

import type { PublicUser } from "@workflow-demo/contracts";

import { getCurrentUser } from "../api/auth-api";

export const CURRENT_USER_QUERY_KEY = ["auth", "current-user"] as const;

async function fetchCurrentUser(): Promise<PublicUser> {
  const result = await getCurrentUser();
  if (!result.ok) {
    throw new Error(`Could not load the current user (${result.failure.kind}).`);
  }
  return result.data.user;
}

/**
 * Seeded with the session user so the name shows at once. The default `staleTime` of 0 and no
 * `initialDataUpdatedAt` make the seed stale immediately, so `/me` is still requested on mount (plan FE-14, A-7).
 */
export function useCurrentUser(sessionUser: PublicUser) {
  return useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: fetchCurrentUser,
    initialData: sessionUser,
    // The fetcher already refreshes and retries a protected 401 once (contract §7); no extra query retries.
    retry: false,
  });
}
