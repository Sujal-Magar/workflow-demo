"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

import type { AuthMode } from "../hooks/use-auth-mode";
import {
  SIGN_IN_BUTTON,
  SIGN_IN_INVITE_HEADING,
  SIGN_IN_INVITE_TEXT,
  SIGN_UP_BUTTON,
  SIGN_UP_INVITE_HEADING,
  SIGN_UP_INVITE_TEXT,
} from "../lib/auth-copy";
import { FintrackLogo } from "./fintrack-logo";

interface BrandPanelProps {
  mode: AuthMode;
  onSwitchMode: (next: AuthMode) => void;
  className?: string;
}

interface InviteContent {
  readonly heading: string;
  readonly text: string;
  readonly buttonLabel: string;
  readonly target: AuthMode;
}

/** In `signin` the overlay invites the visitor to sign up, and the other way round. */
const INVITES: Readonly<Record<AuthMode, InviteContent>> = {
  signin: { heading: SIGN_IN_INVITE_HEADING, text: SIGN_IN_INVITE_TEXT, buttonLabel: SIGN_UP_BUTTON, target: "signup" },
  signup: { heading: SIGN_UP_INVITE_HEADING, text: SIGN_UP_INVITE_TEXT, buttonLabel: SIGN_IN_BUTTON, target: "signin" },
};

const AUTH_MODES: readonly AuthMode[] = ["signin", "signup"];

export function BrandPanel({ mode, onSwitchMode, className }: BrandPanelProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center bg-gradient-to-br from-brand-gradient-from to-brand-gradient-to to-70% px-8 py-8 text-center text-white md:py-0",
        className
      )}
    >
      <FintrackLogo className="md:absolute md:left-0 md:right-0 md:top-12" />
      <div className="relative mt-6 w-full md:mt-0 md:h-full">
        {AUTH_MODES.map((contentMode) => {
          const invite = INVITES[contentMode];
          const isActive = contentMode === mode;
          return (
            <div
              key={contentMode}
              aria-hidden={isActive ? undefined : true}
              className={cn(
                "flex flex-col items-center justify-center md:absolute md:inset-0 motion-safe:transition-[opacity,visibility] motion-safe:duration-[600ms] motion-safe:ease-in-out",
                isActive ? "visible opacity-100" : "invisible hidden opacity-0 md:flex"
              )}
            >
              <p className="text-[36px] font-bold leading-tight">{invite.heading}</p>
              <p className="mt-4 max-w-[262px] text-[15px] leading-5 text-white/95">{invite.text}</p>
              <Button variant="overlay" className="mt-4" onClick={() => onSwitchMode(invite.target)}>
                {invite.buttonLabel}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
