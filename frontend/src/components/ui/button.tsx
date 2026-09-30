"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

import { SpinnerIcon } from "./icons";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70",
  {
    variants: {
      variant: {
        primary:
          "h-10 min-w-40 rounded-md bg-brand-teal px-6 text-base font-medium uppercase tracking-wide text-white hover:bg-brand-teal-dark focus-visible:ring-brand-teal",
        overlay:
          "h-10 min-w-40 rounded-md bg-brand-teal px-6 text-base font-medium uppercase tracking-wide text-white shadow-sm hover:bg-brand-teal-dark focus-visible:ring-white focus-visible:ring-offset-brand-gradient-to",
        link: "rounded-sm text-[15px] text-slate-600 hover:text-brand-ink hover:underline focus-visible:ring-brand-teal",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  }
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, isLoading = false, disabled, children, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant }), className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? <SpinnerIcon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
});
