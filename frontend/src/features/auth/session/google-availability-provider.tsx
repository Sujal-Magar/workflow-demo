"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { env } from "@/lib/env";

interface GoogleAvailability {
  /** False when no client ID is configured or the Google script failed to load. */
  readonly isAvailable: boolean;
}

const GoogleAvailabilityContext = createContext<GoogleAvailability>({ isAvailable: false });

interface GoogleAvailabilityProviderProps {
  children: ReactNode;
  /** Defaults to `NEXT_PUBLIC_GOOGLE_CLIENT_ID`; injectable for tests. */
  clientId?: string | null;
}

export function GoogleAvailabilityProvider({
  children,
  clientId = env.googleClientId,
}: GoogleAvailabilityProviderProps) {
  const [hasScriptFailed, setHasScriptFailed] = useState(false);
  const markScriptFailed = useCallback(() => setHasScriptFailed(true), []);
  const isAvailable = Boolean(clientId) && !hasScriptFailed;
  const value = useMemo<GoogleAvailability>(() => ({ isAvailable }), [isAvailable]);

  if (!clientId) {
    return <GoogleAvailabilityContext.Provider value={value}>{children}</GoogleAvailabilityContext.Provider>;
  }

  return (
    <GoogleOAuthProvider clientId={clientId} onScriptLoadError={markScriptFailed}>
      <GoogleAvailabilityContext.Provider value={value}>{children}</GoogleAvailabilityContext.Provider>
    </GoogleOAuthProvider>
  );
}

export function useGoogleAvailability(): GoogleAvailability {
  return useContext(GoogleAvailabilityContext);
}
