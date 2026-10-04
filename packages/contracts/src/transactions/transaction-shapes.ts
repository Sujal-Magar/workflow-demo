import { z } from "zod";

/** Contract §2.4. */
export const TRANSACTION_CATEGORIES = [
  "food_and_dining",
  "salary",
  "transportation",
  "shopping",
  "investment",
  "freelance_work",
  "bills_and_utilities",
  "health_and_fitness",
  "savings_account",
  "others",
] as const;

/** Contract §2.1. Carries the sign; `amount` itself is always positive (D-03). */
export const TRANSACTION_TYPES = ["income", "expense"] as const;

export const TRANSACTION_TIMEFRAMES = ["this_week", "this_month", "this_year", "all_time"] as const;

export const TRANSACTION_SORTS = ["newest", "oldest"] as const;

export const DEFAULT_TRANSACTION_TIMEFRAME = "this_month";
export const DEFAULT_TRANSACTION_SORT = "newest";

/** Contract §2.1. `userId` is never part of this shape (an internal ownership column). */
export const transactionSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  description: z.string(),
  category: z.enum(TRANSACTION_CATEGORIES),
  type: z.enum(TRANSACTION_TYPES),
  amount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Contract §2.3. */
export const transactionListResponseSchema = z.object({
  data: z.array(transactionSchema),
  total: z.number().int(),
});

/** Contract §2.6. Success body for `deleteTransaction`. */
export const deleteTransactionResponseSchema = z.object({
  success: z.literal(true),
  id: z.string().uuid(),
});

export type Transaction = z.infer<typeof transactionSchema>;
export type TransactionListResponse = z.infer<typeof transactionListResponseSchema>;
export type DeleteTransactionResponse = z.infer<typeof deleteTransactionResponseSchema>;
