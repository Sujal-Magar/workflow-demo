import { z } from "zod";

import {
  DEFAULT_TRANSACTION_SORT,
  DEFAULT_TRANSACTION_TIMEFRAME,
  TRANSACTION_CATEGORIES,
  TRANSACTION_SORTS,
  TRANSACTION_TIMEFRAMES,
  TRANSACTION_TYPES,
} from "./transaction-shapes";

/** Fixed named constants resolved at synthesis (contract §2.2, plan Decision D-08). */
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;

const TITLE_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 255;

/** Contract §4 validation messages (verbatim). */
export const TRANSACTION_VALIDATION_MESSAGES = {
  TITLE_REQUIRED: "Title is required.",
  TITLE_TOO_LONG: "Title must be at most 100 characters.",
  DESCRIPTION_REQUIRED: "Description is required.",
  DESCRIPTION_TOO_LONG: "Description must be at most 255 characters.",
  CATEGORY_REQUIRED: "Category is required.",
  CATEGORY_INVALID: "Select a valid category.",
  TYPE_REQUIRED: "Type is required.",
  TYPE_INVALID: "Select a valid type.",
  AMOUNT_REQUIRED: "Amount is required.",
  AMOUNT_NOT_POSITIVE: "Amount must be greater than 0.",
  PAGE_INVALID: "Page must be a positive integer.",
  LIMIT_INVALID: "Limit must be between 1 and 100.",
  TIMEFRAME_INVALID: "Select a valid timeframe.",
  SORT_INVALID: "Select a valid sort order.",
} as const;

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Rule set `Title` (contract §4). */
export const transactionTitleSchema = z.custom<unknown>().superRefine((value, context) => {
  const text = asText(value).trim();

  if (text.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: TRANSACTION_VALIDATION_MESSAGES.TITLE_REQUIRED });
    return;
  }
  if (text.length > TITLE_MAX_LENGTH) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: TRANSACTION_VALIDATION_MESSAGES.TITLE_TOO_LONG });
  }
});

/** Rule set `Description` (contract §4). */
export const transactionDescriptionSchema = z.custom<unknown>().superRefine((value, context) => {
  const text = asText(value).trim();

  if (text.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: TRANSACTION_VALIDATION_MESSAGES.DESCRIPTION_REQUIRED });
    return;
  }
  if (text.length > DESCRIPTION_MAX_LENGTH) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: TRANSACTION_VALIDATION_MESSAGES.DESCRIPTION_TOO_LONG });
  }
});

/** Rule set `Category` (contract §4): required. */
export const transactionCategorySchema = z.custom<unknown>().superRefine((value, context) => {
  const text = asText(value);

  if (text.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: TRANSACTION_VALIDATION_MESSAGES.CATEGORY_REQUIRED });
    return;
  }
  if (!(TRANSACTION_CATEGORIES as readonly string[]).includes(text)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: TRANSACTION_VALIDATION_MESSAGES.CATEGORY_INVALID });
  }
});

/** Rule set `Type` (contract §4): required. */
export const transactionTypeSchema = z.custom<unknown>().transform((value, context) => {
  const text = asText(value);

  if (text.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: TRANSACTION_VALIDATION_MESSAGES.TYPE_REQUIRED });
    return;
  }
  if (!(TRANSACTION_TYPES as readonly string[]).includes(text)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: TRANSACTION_VALIDATION_MESSAGES.TYPE_INVALID });
  }
});

/** Rule set `Amount` (contract §4): always positive (D-03). */
export const transactionAmountSchema = z.custom<unknown>().transform((value, context): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: TRANSACTION_VALIDATION_MESSAGES.AMOUNT_REQUIRED });
    return 0;
  }
  if (value <= 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: TRANSACTION_VALIDATION_MESSAGES.AMOUNT_NOT_POSITIVE });
    return value;
  }
  return value;
});

function parsePositiveInteger(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const text = typeof value === "string" ? value : String(value);
  if (!/^\d+$/.test(text)) {
    return null;
  }
  return Number(text);
}

/** Rule set `Page` (contract §4): optional, defaults to `DEFAULT_PAGE`. */
export const transactionPageSchema = z.custom<unknown>().transform((value, context): number => {
  if (value === undefined) {
    return DEFAULT_PAGE;
  }
  const parsed = parsePositiveInteger(value);
  if (parsed === null || parsed < 1) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: TRANSACTION_VALIDATION_MESSAGES.PAGE_INVALID });
    return DEFAULT_PAGE;
  }
  return parsed;
});

/** Rule set `Limit` (contract §4): optional, defaults to `DEFAULT_LIMIT`, bounded by `MAX_LIMIT`. */
export const transactionLimitSchema = z.custom<unknown>().transform((value, context): number => {
  if (value === undefined) {
    return DEFAULT_LIMIT;
  }
  const parsed = parsePositiveInteger(value);
  if (parsed === null || parsed < 1 || parsed > MAX_LIMIT) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: TRANSACTION_VALIDATION_MESSAGES.LIMIT_INVALID });
    return DEFAULT_LIMIT;
  }
  return parsed;
});

/** Rule set `CategoryFilter` (contract §4): optional, absent = "All Category". */
export const transactionCategoryFilterSchema = z.custom<unknown>().transform((value, context): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  const text = asText(value);
  if (!(TRANSACTION_CATEGORIES as readonly string[]).includes(text)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: TRANSACTION_VALIDATION_MESSAGES.CATEGORY_INVALID });
    return undefined;
  }
  return text;
});

/** Rule set `TypeFilter` (contract §4): optional, absent = "All Types". */
export const transactionTypeFilterSchema = z.custom<unknown>().transform((value, context): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  const text = asText(value);
  if (!(TRANSACTION_TYPES as readonly string[]).includes(text)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: TRANSACTION_VALIDATION_MESSAGES.TYPE_INVALID });
    return undefined;
  }
  return text;
});

/** Rule set `Timeframe` (contract §4): optional, defaults to `DEFAULT_TRANSACTION_TIMEFRAME` (D-05 — no "today"). */
export const transactionTimeframeSchema = z.custom<unknown>().transform((value, context): string => {
  if (value === undefined) {
    return DEFAULT_TRANSACTION_TIMEFRAME;
  }
  const text = asText(value);
  if (!(TRANSACTION_TIMEFRAMES as readonly string[]).includes(text)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: TRANSACTION_VALIDATION_MESSAGES.TIMEFRAME_INVALID });
    return DEFAULT_TRANSACTION_TIMEFRAME;
  }
  return text;
});

/** Rule set `Sort` (contract §4): optional, defaults to `DEFAULT_TRANSACTION_SORT`. */
export const transactionSortSchema = z.custom<unknown>().transform((value, context): string => {
  if (value === undefined) {
    return DEFAULT_TRANSACTION_SORT;
  }
  const text = asText(value);
  if (!(TRANSACTION_SORTS as readonly string[]).includes(text)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: TRANSACTION_VALIDATION_MESSAGES.SORT_INVALID });
    return DEFAULT_TRANSACTION_SORT;
  }
  return text;
});

/** Composed set `CreateTransactionRequest` (contract §2.5, §4). Unknown fields, including a sent `date`, are stripped (contract §1, D-17). */
export const createTransactionRequestSchema = z.object({
  title: transactionTitleSchema,
  description: transactionDescriptionSchema,
  category: transactionCategorySchema,
  type: transactionTypeSchema,
  amount: transactionAmountSchema,
});

/** Composed set `UpdateTransactionRequest` (contract §2.5, §4): identical — full replace, not a patch (D-01). */
export const updateTransactionRequestSchema = createTransactionRequestSchema;

/** Composed set `TransactionListQuery` (contract §2.2, §4). */
export const transactionListQuerySchema = z.object({
  page: transactionPageSchema,
  limit: transactionLimitSchema,
  category: transactionCategoryFilterSchema,
  type: transactionTypeFilterSchema,
  timeframe: transactionTimeframeSchema,
  sort: transactionSortSchema,
});

export type CreateTransactionRequest = z.infer<typeof createTransactionRequestSchema>;
export type UpdateTransactionRequest = z.infer<typeof updateTransactionRequestSchema>;
export type TransactionListQuery = z.infer<typeof transactionListQuerySchema>;
