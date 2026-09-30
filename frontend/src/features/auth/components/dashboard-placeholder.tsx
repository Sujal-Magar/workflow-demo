"use client";

import { useCurrentUser } from "../hooks/use-current-user";
import { signedInAs } from "../lib/auth-copy";
import type { PublicUser } from "../mocks/auth-types.mock";
import { FintrackLogo } from "./fintrack-logo";
import { SignOutButton } from "./sign-out-button";

interface DashboardPlaceholderProps {
  sessionUser: PublicUser;
}

/** Minimal `/dashboard` until the `dashboard` feature replaces it (REQ-AUTH-07). */
export function DashboardPlaceholder({ sessionUser }: DashboardPlaceholderProps) {
  const { data: currentUser } = useCurrentUser(sessionUser);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="flex w-full max-w-[420px] flex-col items-center rounded-3xl bg-white px-8 py-10 text-center shadow-[0_24px_60px_-20px_rgba(15,23,42,0.25)]">
        <FintrackLogo tone="onLight" />
        <h1 className="mt-8 font-display text-2xl font-bold text-brand-ink">{signedInAs(currentUser.name)}</h1>
        <div className="mt-6">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
