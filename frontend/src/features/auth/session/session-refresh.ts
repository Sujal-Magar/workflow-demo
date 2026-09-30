import type { SessionPayload } from "@workflow-demo/contracts";

import { refreshSession as requestSessionRefresh } from "../api/auth-api";
import type { AuthResult } from "../lib/auth-error";

let inFlightRefresh: Promise<AuthResult<SessionPayload>> | null = null;

/**
 * Single-flight refresh: every concurrent caller (restore, renewal timer, the fetcher's 401 retry, StrictMode's
 * double effects) shares one request, because the server rotates the refresh cookie with no grace window.
 */
export function refreshSessionOnce(): Promise<AuthResult<SessionPayload>> {
  if (!inFlightRefresh) {
    inFlightRefresh = requestSessionRefresh().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}
