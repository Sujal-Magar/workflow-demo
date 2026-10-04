"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { CalendarIcon, ChevronDownIcon } from "@/components/ui/icons";
import { FieldError } from "@/components/ui/field-error";
import { SelectField, type SelectFieldOption } from "@/components/ui/select-field";
import { cn } from "@/lib/cn";

import { CATEGORIES } from "../api/transactions-api";
import type { TransactionFormValues } from "../lib/transaction-form-schemas";
import { CATEGORY_LABELS } from "./category-icon";
import { TRANSACTION_TYPE_LABELS } from "./transaction-type-badge";

const CATEGORY_OPTIONS: readonly SelectFieldOption[] = [
  { value: "", label: "All Category" },
  ...CATEGORIES.map((category) => ({ value: category, label: CATEGORY_LABELS[category] })),
];

const TYPE_OPTIONS: readonly SelectFieldOption[] = [
  { value: "", label: "All Types" },
  { value: "income", label: TRANSACTION_TYPE_LABELS.income },
  { value: "expense", label: TRANSACTION_TYPE_LABELS.expense },
];

interface TransactionFormFieldsProps {
  register: UseFormRegister<TransactionFormValues>;
  errors: FieldErrors<TransactionFormValues>;
  /** Watched current value of the `date` field, used to approximate the FDS `"Title"` placeholder (plan FE-06). */
  dateValue: string;
}

/** Shared by Add and Edit (plan FE-06; `rules/conventions.md` "avoid duplicated logic"). */
export function TransactionFormFields({ register, errors, dateValue }: Readonly<TransactionFormFieldsProps>) {
  const hasDateValue = Boolean(dateValue);

  return (
    <div className="flex flex-col gap-4">
      <div className="w-full">
        <label htmlFor="transaction-date" className="sr-only">
          Date
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-[14px] top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-gray-500">
            <CalendarIcon className="h-5 w-5" />
          </span>
          {!hasDateValue ? (
            <span className="pointer-events-none absolute left-[42px] top-1/2 -translate-y-1/2 text-[15px] text-gray-500">
              Title
            </span>
          ) : null}
          <input
            id="transaction-date"
            type="date"
            aria-invalid={Boolean(errors.date) || undefined}
            aria-describedby={errors.date ? "transaction-date-error" : undefined}
            className={cn(
              "h-12 w-full rounded-[3px] border border-gray-300 bg-white pl-[42px] pr-9 text-[15px] text-brand-ink focus:border-brand-teal focus:outline-none focus:ring-1 focus:ring-brand-teal",
              // The native date input's own "mm/dd/yyyy" placeholder text is hidden so the "Title" overlay above shows instead.
              !hasDateValue && "text-transparent",
              errors.date && "border-red-500 focus:border-red-500 focus:ring-red-500"
            )}
            {...register("date")}
          />
          <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        </div>
        <FieldError id="transaction-date-error" message={errors.date?.message} />
      </div>

      <div className="w-full">
        <label htmlFor="transaction-description" className="sr-only">
          Description
        </label>
        <input
          id="transaction-description"
          placeholder="Enter Description"
          aria-invalid={Boolean(errors.description) || undefined}
          aria-describedby={errors.description ? "transaction-description-error" : undefined}
          className={cn(
            "h-11 w-full rounded-md border border-gray-300 px-3 text-[15px] text-brand-ink placeholder:text-gray-500 focus:border-brand-teal focus:outline-none focus:ring-1 focus:ring-brand-teal",
            errors.description && "border-red-500 focus:border-red-500 focus:ring-red-500"
          )}
          {...register("description")}
        />
        <FieldError id="transaction-description-error" message={errors.description?.message} />
      </div>

      <SelectField
        label="Category"
        options={CATEGORY_OPTIONS}
        error={errors.category?.message}
        {...register("category")}
      />

      <SelectField label="Type" options={TYPE_OPTIONS} error={errors.type?.message} {...register("type")} />

      <div className="w-full">
        <label htmlFor="transaction-amount" className="sr-only">
          Amount
        </label>
        <input
          id="transaction-amount"
          inputMode="decimal"
          placeholder="Amount"
          aria-invalid={Boolean(errors.amount) || undefined}
          aria-describedby={errors.amount ? "transaction-amount-error" : undefined}
          className={cn(
            "h-11 w-full rounded-md border border-gray-300 px-3 text-[15px] text-brand-ink placeholder:text-gray-500 focus:border-brand-teal focus:outline-none focus:ring-1 focus:ring-brand-teal",
            errors.amount && "border-red-500 focus:border-red-500 focus:ring-red-500"
          )}
          {...register("amount")}
        />
        <FieldError id="transaction-amount-error" message={errors.amount?.message} />
      </div>
    </div>
  );
}
