"use client";

import { forwardRef, useId, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  containerClassName?: string;
}

/** A presentational checkbox wrapping a native input (no `@radix-ui/react-checkbox`; not an approved library). */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, id, className, containerClassName, ...inputProps },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className={cn("flex items-center gap-2", containerClassName)}>
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className={cn(
          "h-5 w-5 shrink-0 cursor-pointer rounded border-gray-300 text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal disabled:cursor-not-allowed disabled:opacity-70",
          className
        )}
        {...inputProps}
      />
      <label htmlFor={inputId} className="cursor-pointer select-none text-[15px] text-brand-ink">
        {label}
      </label>
    </div>
  );
});
