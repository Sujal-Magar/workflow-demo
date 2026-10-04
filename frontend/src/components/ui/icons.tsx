import type { SVGProps } from "react";

import { cn } from "@/lib/cn";

export type IconProps = SVGProps<SVGSVGElement>;

function StrokeIcon({ children, ...props }: Readonly<IconProps>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function UserIcon(props: Readonly<IconProps>) {
  return (
    <StrokeIcon {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19.5c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" />
    </StrokeIcon>
  );
}

export function MailIcon(props: Readonly<IconProps>) {
  return (
    <StrokeIcon {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </StrokeIcon>
  );
}

export function LockIcon(props: Readonly<IconProps>) {
  return (
    <StrokeIcon {...props}>
      <rect x="5" y="10.5" width="14" height="10" rx="1.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15.5" r="1" fill="currentColor" stroke="none" />
    </StrokeIcon>
  );
}

export function EyeIcon(props: Readonly<IconProps>) {
  return (
    <StrokeIcon {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </StrokeIcon>
  );
}

export function EyeOffIcon(props: Readonly<IconProps>) {
  return (
    <StrokeIcon {...props}>
      <path d="M10.6 5.6A10 10 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4" />
      <path d="M6.6 6.7C4 8.4 2.5 12 2.5 12S6 18.5 12 18.5a9.6 9.6 0 0 0 5.2-1.5" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m3 3 18 18" />
    </StrokeIcon>
  );
}

export function CloseIcon(props: Readonly<IconProps>) {
  return (
    <StrokeIcon {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </StrokeIcon>
  );
}

export function SpinnerIcon({ className, ...props }: Readonly<IconProps>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn("animate-spin", className)}
      {...props}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronDownIcon(props: Readonly<IconProps>) {
  return (
    <StrokeIcon {...props}>
      <path d="m6 9 6 6 6-6" />
    </StrokeIcon>
  );
}

export function EditIcon(props: Readonly<IconProps>) {
  return (
    <StrokeIcon {...props}>
      <path d="M4 20h4L18.5 9.5a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5Z" />
      <path d="M13.5 7.5l3 3" />
    </StrokeIcon>
  );
}

export function TrashIcon(props: Readonly<IconProps>) {
  return (
    <StrokeIcon {...props}>
      <path d="M4.5 7h15" />
      <path d="M9 7V4.5h6V7" />
      <path d="M6.5 7l1 12.5a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
      <path d="M10.5 11v6M13.5 11v6" />
    </StrokeIcon>
  );
}

/** Solid status circles for the banner toasts (`transaction-toast-success.png`, `transaction-toast-error.png`). */
export function CheckCircleIcon(props: Readonly<IconProps>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path
        d="m7.5 12.5 3 3 6-6.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AlertCircleIcon(props: Readonly<IconProps>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path d="M12 7v6" fill="none" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="1.25" fill="#ffffff" />
    </svg>
  );
}

/** Single-colour grey "G" matching the visual references (used when Google sign-in is unavailable). */
export function GoogleGIcon(props: Readonly<IconProps>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="4 4 40 40"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}
