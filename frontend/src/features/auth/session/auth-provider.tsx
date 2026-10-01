"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { PublicUser, SessionPayload } from "@workflow-demo/contracts";

import { clearAccessToken, setAccessToken } from "@/lib/access-token-store";
import { registerSessionHandlers } from "@/lib/api-client";

import { logout as requestLogout } from "../api/auth-api";
import { refreshSessionOnce } from "./session-refresh";
import { AuthContext, type AuthContextValue, type AuthStatus } from "./use-auth";

/** Renew this long before the access token expires (D-09). */
export const RENEWAL_LEAD_SECONDS = 60;
const MILLISECONDS_PER_SECOND = 1000;
const SIGNED_OUT_ROUTE = "/auth";

interface SessionState {
  readonly status: AuthStatus;
  readonly user: PublicUser | null;
}

const LOADING_STATE: SessionState = { status: "loading", user: null };
const SIGNED_OUT_STATE: SessionState = { status: "unauthenticated", user: null };

export function renewalDelayMs(expiresInSeconds: number): number {
  return Math.max(0, (expiresInSeconds - RENEWAL_LEAD_SECONDS) * MILLISECONDS_PER_SECOND);
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<SessionState>(LOADING_STATE);
  const renewalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Renewal needs refreshSession/expireSession, which themselves depend on establishSession; a ref breaks the cycle.
  const renewSessionRef = useRef<() => void>(() => undefined);

  const cancelRenewal = useCallback(() => {
    if (renewalTimerRef.current !== null) {
      clearTimeout(renewalTimerRef.current);
      renewalTimerRef.current = null;
    }
  }, []);

  const establishSession = useCallback(
    (payload: SessionPayload) => {
      setAccessToken(payload.accessToken, payload.expiresIn);
      setSession({ status: "authenticated", user: payload.user });
      cancelRenewal();
      renewalTimerRef.current = setTimeout(() => renewSessionRef.current(), renewalDelayMs(payload.expiresIn));
    },
    [cancelRenewal]
  );

  const clearSession = useCallback(() => {
    clearAccessToken();
    cancelRenewal();
    queryClient.clear();
    setSession(SIGNED_OUT_STATE);
  }, [cancelRenewal, queryClient]);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    const result = await refreshSessionOnce();
    if (!result.ok) {
      return false;
    }
    establishSession(result.data);
    return true;
  }, [establishSession]);

  const expireSession = useCallback(() => {
    clearSession();
    router.replace(SIGNED_OUT_ROUTE);
  }, [clearSession, router]);

  const logout = useCallback(async () => {
    // The outcome is irrelevant: the local session is cleared either way (behavior §7).
    await requestLogout();
    clearSession();
    router.replace(SIGNED_OUT_ROUTE);
  }, [clearSession, router]);

  useEffect(() => {
    renewSessionRef.current = () => {
      void refreshSession().then((isRenewed) => {
        if (!isRenewed) {
          expireSession();
        }
      });
    };
  }, [refreshSession, expireSession]);

  // Restore on mount. A failure (401, network, 5xx) leaves the visitor signed out, with no toast and no redirect.
  useEffect(() => {
    let isMounted = true;
    void refreshSession().then((isRestored) => {
      if (!isRestored && isMounted) {
        setSession((current) => (current.status === "loading" ? SIGNED_OUT_STATE : current));
      }
    });
    return () => {
      isMounted = false;
    };
  }, [refreshSession]);

  useEffect(() => cancelRenewal, [cancelRenewal]);

  // Lets the API fetcher refresh and retry a protected 401, or expire the session (D-23). The returned unregister
  // function is the cleanup, so StrictMode's double mount leaves exactly one registration.
  useEffect(
    () => registerSessionHandlers({ refreshSession, onSessionExpired: expireSession }),
    [refreshSession, expireSession]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status: session.status,
      user: session.user,
      establishSession,
      clearSession,
      refreshSession,
      expireSession,
      logout,
    }),
    [session, establishSession, clearSession, refreshSession, expireSession, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
