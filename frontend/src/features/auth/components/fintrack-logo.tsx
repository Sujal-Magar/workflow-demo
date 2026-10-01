import { cn } from "@/lib/cn";

import { LOGO_TAGLINE } from "../lib/auth-copy";

interface FintrackLogoProps {
  /** `onDark` for the gradient brand panel, `onLight` for white cards. */
  tone?: "onDark" | "onLight";
  className?: string;
}

/** Inline wordmark (D-04): no logo file is supplied. */
export function FintrackLogo({ tone = "onDark", className }: Readonly<FintrackLogoProps>) {
  const accentClass = tone === "onDark" ? "text-white" : "text-brand-teal";
  return (
    <div className={cn("flex select-none flex-col items-center leading-none", className)} aria-label="FinTrack">
      <span aria-hidden="true" className="font-display text-[22px] font-bold tracking-tight">
        <span className="text-brand-ink">Fin</span>
        <span className={cn("relative", accentClass)}>
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute -left-[3px] -top-[9px] h-[15px] w-[15px]"
            focusable="false"
          >
            <path d="M1.5 14.5 7 8.5l2.5 2.5 5-6.5" />
            <path d="M10.5 4.5h4v4" />
          </svg>
          Track
        </span>
      </span>
      <span aria-hidden="true" className={cn("mt-[3px] text-[6.5px] font-medium", accentClass)}>
        {LOGO_TAGLINE}
      </span>
    </div>
  );
}
