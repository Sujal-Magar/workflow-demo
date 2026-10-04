"use client";

import { forwardRef, useId, type SelectHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

import { ChevronDownIcon } from "./icons";
import { FieldError } from "./field-error";

export interface SelectFieldOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  /** Visually hidden label for assistive tech. */
  label: string;
  options: readonly SelectFieldOption[];
  error?: string;
  containerClassName?: string;
}

/** Native `<select>`-based presentational field (plan FE-01) — no `@radix-ui/react-select`, not an approved library. */
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, options, error, id, className, containerClassName, ...selectProps },
  ref
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;
  const hasError = Boolean(error);

  return (
    <div className={cn("w-full", containerClassName)}>
      <label htmlFor={selectId} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : undefined}
          className={cn(
            "h-11 w-full appearance-none rounded-md border border-gray-300 bg-white pl-3 pr-9 text-[15px] text-brand-ink focus:border-brand-teal focus:outline-none focus:ring-1 focus:ring-brand-teal",
            hasError && "border-red-500 focus:border-red-500 focus:ring-red-500",
            className
          )}
          {...selectProps}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
      </div>
      <FieldError id={errorId} message={error} />
    </div>
  );
});
