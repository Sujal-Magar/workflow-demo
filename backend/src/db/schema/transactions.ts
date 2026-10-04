import { check, index, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

import { users } from "./auth";

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

export const TRANSACTION_TYPES = ["income", "expense"] as const;

// `date` is a plain YYYY-MM-DD calendar date (no time component); timestamps are ISO-8601 UTC
// text; `id` is a UUID generated in code (plan BE-01).
export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    description: text("description").notNull(),
    category: text("category", { enum: TRANSACTION_CATEGORIES }).notNull(),
    type: text("type", { enum: TRANSACTION_TYPES }).notNull(),
    amount: real("amount").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    userIdIndex: index("transactions_user_id_idx").on(table.userId),
    userIdDateIndex: index("transactions_user_id_date_idx").on(table.userId, table.date),
    // drizzle-kit 0.24 does not emit CHECK constraints; the generated migration carries it by hand
    // (same pattern as `user_profiles_monthly_start_date_check`, plan BE-01).
    amountPositiveCheck: check("transactions_amount_check", sql`${table.amount} > 0`),
  })
);
