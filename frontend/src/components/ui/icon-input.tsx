"use client";

import * as Label from "@radix-ui/react-label";
import { forwardRef, useEffect, useId, useRef, type InputHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { FieldError } from "./field-error";

const SHAKE_CLASS = "motion-safe:animate-shake";

export interface IconInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "placeholder"> {
  /** Visually hidden label; also used as the placeholder shown in the visuals. */
  label: string;
  icon: ReactNode;
  trailing?: ReactNode;
  error?: string;
  /** Replays the shake animation each time this counter increases (0 = never shaken). */
  shakeSignal?: number;
  containerClassName?: string;
}

export const IconInput = forwardRef<HTMLInputElement, IconInputProps>(function IconInput(
  { label, icon, trailing, error, shakeSignal = 0, containerClassName, id, className, ...inputProps },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const boxRef = useRef<HTMLDivElement>(null);
  const hasError = Boolean(error);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || shakeSignal === 0) {
      return;
    }
    // Restart the CSS animation on every new failure without remounting the input.
    box.classList.remove(SHAKE_CLASS);
    void box.offsetWidth;
    box.classList.add(SHAKE_CLASS);
  }, [shakeSignal]);

  return (
    <div className={cn("w-80 max-w-full", containerClassName)}>
      <Label.Root htmlFor={inputId} className="sr-only">
        {label}
      </Label.Root>
      <div ref={boxRef} className={cn("relative", shakeSignal > 0 && SHAKE_CLASS)}>
        <span className="pointer-events-none absolute left-[14px] top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-gray-500 [&>svg]:h-5 [&>svg]:w-5">
          {icon}
        </span>
        <input
          ref={ref}
          id={inputId}
          placeholder={label}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : undefined}
          className={cn(
            "h-12 w-full rounded-[3px] border border-gray-300 bg-white pl-[42px] pr-3 text-[15px] text-brand-ink placeholder:text-gray-500 focus:border-brand-teal focus:outline-none focus:ring-1 focus:ring-brand-teal",
            trailing ? "pr-11" : null,
            hasError && "border-red-500 focus:border-red-500 focus:ring-red-500",
            className
          )}
          {...inputProps}
        />
        {trailing ? (
          <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center">{trailing}</span>
        ) : null}
      </div>
      <FieldError id={errorId} message={error} />
    </div>
  );
});
