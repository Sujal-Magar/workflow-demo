"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";

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
}

/** Shared by Add and Edit (plan FE-06; `rules/conventions.md` "avoid duplicated logic"). */
export function TransactionFormFields({ register, errors }: Readonly<TransactionFormFieldsProps>) {
  return (
    <div className="flex flex-col gap-4">
      <div className="w-full">
        <label htmlFor="transaction-title" className="sr-only">
          Title
        </label>
        <input
          id="transaction-title"
          placeholder="Title"
          aria-invalid={Boolean(errors.title) || undefined}
          aria-describedby={errors.title ? "transaction-title-error" : undefined}
          className={cn(
            "h-11 w-full rounded-md border border-gray-300 px-3 text-[15px] text-brand-ink placeholder:text-gray-500 focus:border-brand-teal focus:outline-none focus:ring-1 focus:ring-brand-teal",
            errors.title && "border-red-500 focus:border-red-500 focus:ring-red-500"
          )}
          {...register("title")}
        />
        <FieldError id="transaction-title-error" message={errors.title?.message} />
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
