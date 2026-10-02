"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getProfile } from "../api/profile-api";
import type { UserProfile } from "@workflow-demo/contracts";

export const PROFILE_QUERY_KEY = ["profile"] as const;

async function fetchProfile(): Promise<UserProfile> {
  const result = await getProfile();
  if (!result.ok) {
    throw new Error(`Could not load the profile (${result.failure.kind}).`);
  }
  return result.data;
}

/** No seed data: unlike `auth`'s session user, `UserProfile` is not already known on first render. */
export function useProfile(): UseQueryResult<UserProfile> {
  return useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: fetchProfile,
    // The fetcher already refreshes and retries a protected 401 once (contract §1); no extra query retries.
    retry: false,
  });
}
