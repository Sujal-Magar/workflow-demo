// Stand-in for `@react-oauth/google` (plan §8.2): tests never load Google's script or call Google.
// Install with `vi.mock("@react-oauth/google", async () => (await import("@/test/google-oauth-mock")).googleOAuthMock)`.
import type { ReactNode } from "react";

import type { CredentialResponse } from "@react-oauth/google";

export const GOOGLE_TEST_CREDENTIAL = "google-id-token-from-popup";
export const COMPLETE_POPUP_LABEL = "Complete Google popup";
export const EMPTY_POPUP_LABEL = "Google popup without credential";
export const DISMISS_POPUP_LABEL = "Dismiss Google popup";

/** Lets a test simulate the Google script failing to load after the provider mounted. */
export const googleScript = { failToLoad: (): void => undefined };

interface GoogleOAuthProviderProps {
  children: ReactNode;
  clientId: string;
  onScriptLoadError?: () => void;
}

function GoogleOAuthProvider({ children, onScriptLoadError }: GoogleOAuthProviderProps) {
  googleScript.failToLoad = () => onScriptLoadError?.();
  return <>{children}</>;
}

interface GoogleLoginProps {
  onSuccess: (response: CredentialResponse) => void;
  onError?: () => void;
}

function GoogleLogin({ onSuccess, onError }: GoogleLoginProps) {
  return (
    <>
      <button type="button" onClick={() => onSuccess({ credential: GOOGLE_TEST_CREDENTIAL })}>
        {COMPLETE_POPUP_LABEL}
      </button>
      <button type="button" onClick={() => onSuccess({})}>
        {EMPTY_POPUP_LABEL}
      </button>
      <button type="button" onClick={() => onError?.()}>
        {DISMISS_POPUP_LABEL}
      </button>
    </>
  );
}

export const googleOAuthMock = { GoogleOAuthProvider, GoogleLogin };
