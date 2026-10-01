"use client";

import { useState } from "react";

import { RESET_PAGE_TITLE } from "../lib/auth-copy";
import { FintrackLogo } from "./fintrack-logo";
import { InvalidResetLink } from "./invalid-reset-link";
import { ResetPasswordForm } from "./reset-password-form";

interface ResetPasswordCardProps {
  /** The `token` query parameter; missing or empty shows the invalid-link state without any request. */
  token: string | null;
}

export function ResetPasswordCard({ token }: Readonly<ResetPasswordCardProps>) {
  const [isTokenRejected, setIsTokenRejected] = useState(false);
  const isLinkInvalid = !token || isTokenRejected;

  return (
    <div className="w-full max-w-[420px] rounded-3xl bg-white px-8 py-10 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.25)] sm:px-12">
      <FintrackLogo tone="onLight" />
      <h1 className="mt-8 text-center font-display text-[28px] font-bold leading-tight text-brand-ink">
        {RESET_PAGE_TITLE}
      </h1>
      <div className="mt-6">
        {isLinkInvalid ? (
          <InvalidResetLink />
        ) : (
          <ResetPasswordForm token={token} onInvalidToken={() => setIsTokenRejected(true)} />
        )}
      </div>
    </div>
  );
}
