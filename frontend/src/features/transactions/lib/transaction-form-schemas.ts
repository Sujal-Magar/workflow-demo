// Form-only validation for the Add/Edit Transaction dialogs (plan FE-06), mirroring contract.md §4's
// `TransactionDate`/`Description`/`Category`/`Type`/`Amount` rule sets exactly (same messages, same order).
// `updateTransaction` reuses this schema unchanged — it is a full replace of the editable fields (D-01).
import { z } from "zod";

import { CATEGORIES, TRANSACTION_TYPES, type Category, type TransactionType } from "../api/transactions-api";

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function requiredEnum<T extends string>(
  values: readonly T[],
  messages: { readonly required: string; readonly invalid: string }
) {
  return z
    .string()
    .superRefine((value, ctx) => {
      if (value.trim() === "") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: messages.required });
        return;
      }
      if (!(values as readonly string[]).includes(value)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: messages.invalid });
      }
    })
    .transform((value) => value as T);
}

export const transactionDateSchema = z
  .string()
  .min(1, "Date is required.")
  .refine(isValidCalendarDate, "Enter a valid date.");

export const transactionDescriptionSchema = z
  .string()
  .trim()
  .min(1, "Description is required.")
  .max(255, "Description must be at most 255 characters.");

export const transactionCategorySchema = requiredEnum<Category>(CATEGORIES, {
  required: "Category is required.",
  invalid: "Select a valid category.",
});

export const transactionTypeSchema = requiredEnum<TransactionType>(TRANSACTION_TYPES, {
  required: "Type is required.",
  invalid: "Select a valid type.",
});

export const transactionAmountSchema = z
  .union([z.string(), z.number()])
  .superRefine((value, ctx) => {
    const isEmptyString = typeof value === "string" && value.trim() === "";
    const numericValue = typeof value === "string" ? Number(value.trim()) : value;
    if (isEmptyString || Number.isNaN(numericValue)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Amount is required." });
      return;
    }
    if (numericValue <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Amount must be greater than 0." });
    }
  })
  .transform((value) => (typeof value === "string" ? Number(value.trim()) : value));

export const transactionFormSchema = z.object({
  date: transactionDateSchema,
  description: transactionDescriptionSchema,
  category: transactionCategorySchema,
  type: transactionTypeSchema,
  amount: transactionAmountSchema,
});

export type TransactionFormValues = z.input<typeof transactionFormSchema>;
export type TransactionFormOutput = z.output<typeof transactionFormSchema>;
