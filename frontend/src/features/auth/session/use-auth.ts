"use client";

import { createContext, useContext } from "react";

import type { PublicUser, SessionPayload } from "@workflow-demo/contracts";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthContextValue {
  readonly status: AuthStatus;
  readonly user: PublicUser | null;
  /** Stores the token in memory, marks the user signed in and schedules renewal. */
  establishSession: (payload: SessionPayload) => void;
  /** Empties the token store, cancels renewal, clears the query cache and marks the user signed out. */
  clearSession: () => void;
  /** Single-flight refresh: `true` after establishing the renewed session, `false` (and no change) on failure. */
  refreshSession: () => Promise<boolean>;
  /** The one "session is gone" path: clears the session and redirects to `/auth`. */
  expireSession: () => void;
  /** Calls the logout operation, then clears the session and redirects to `/auth` whatever the outcome. */
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }
  return context;
}
