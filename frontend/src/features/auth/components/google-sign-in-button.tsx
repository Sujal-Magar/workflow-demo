"use client";

import { GoogleLogin } from "@react-oauth/google";

import { GoogleGIcon, SpinnerIcon } from "@/components/ui/icons";

import type { GoogleSignInControls } from "../hooks/use-google-sign-in";
import { GOOGLE_BUTTON_LABEL } from "../lib/auth-copy";
import { useGoogleAvailability } from "../session/google-availability-provider";

interface GoogleSignInButtonProps {
  controls: GoogleSignInControls;
}

export function GoogleSignInButton({ controls }: Readonly<GoogleSignInButtonProps>) {
  const { isAvailable } = useGoogleAvailability();

  if (!isAvailable) {
    return (
      <button
        type="button"
        aria-label={GOOGLE_BUTTON_LABEL}
        onClick={controls.notifyUnavailable}
        className="flex h-10 w-10 items-center justify-center rounded-full text-[#666666] transition-colors hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
      >
        <GoogleGIcon className="h-[37px] w-[37px]" />
      </button>
    );
  }

  if (controls.isPending) {
    return (
      <output aria-busy="true" className="flex h-10 w-10 items-center justify-center rounded-full">
        <SpinnerIcon className="h-6 w-6 text-brand-teal" />
        <span className="sr-only">{GOOGLE_BUTTON_LABEL}…</span>
      </output>
    );
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center">
      <GoogleLogin
        type="icon"
        shape="circle"
        size="large"
        onSuccess={controls.handleCredentialResponse}
        onError={controls.handleGoogleError}
      />
    </div>
  );
}
