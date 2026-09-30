"use client";

import type { CredentialResponse } from "@react-oauth/google";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

import { useToast } from "@/components/ui/toast";

import { googleOAuthLogin } from "../api/auth-api";
import { GOOGLE_FAILED_TOAST, GOOGLE_UNAVAILABLE_TOAST } from "../lib/auth-copy";
import { useAuth } from "../session/use-auth";

export interface GoogleSignInControls {
  readonly isPending: boolean;
  handleCredentialResponse: (response: CredentialResponse) => void;
  /** Popup dismissed or closed: deliberately a no-op (no toast, no state change). */
  handleGoogleError: () => void;
  notifyUnavailable: () => void;
}

const ignoreGoogleError = (): void => undefined;

/**
 * Called once, in `AuthCard`, and shared by both panels: Google Identity Services keeps only the last registered
 * callback, which may belong to the hidden panel, so both buttons must run the same handler and pending state.
 */
export function useGoogleSignIn(): GoogleSignInControls {
  const router = useRouter();
  const toast = useToast();
  const { establishSession } = useAuth();
  const { mutateAsync, isPending } = useMutation({ mutationFn: googleOAuthLogin });

  const handleCredentialResponse = useCallback(
    (response: CredentialResponse) => {
      const credential = response.credential;
      if (!credential || isPending) {
        return;
      }
      void mutateAsync({ token: credential }).then((result) => {
        if (result.ok) {
          establishSession(result.data);
          router.replace("/dashboard");
          return;
        }
        toast.error(GOOGLE_FAILED_TOAST);
      });
    },
    [establishSession, isPending, mutateAsync, router, toast]
  );

  const notifyUnavailable = useCallback(() => toast.error(GOOGLE_UNAVAILABLE_TOAST), [toast]);

  return useMemo(
    () => ({ isPending, handleCredentialResponse, handleGoogleError: ignoreGoogleError, notifyUnavailable }),
    [isPending, handleCredentialResponse, notifyUnavailable]
  );
}
