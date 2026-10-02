import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { users } from "./auth";

export const PREFERRED_CURRENCIES = ["NPR", "USD", "EUR", "GBP"] as const;
export const LANGUAGES = ["en_US", "en_GB", "es", "fr"] as const;

export const MONTHLY_START_DATE_MIN = 1;
export const MONTHLY_START_DATE_MAX = 28;

// Timestamps are ISO-8601 UTC text; ids are UUIDs generated in code. One row per user (D-11).
export const userProfiles = sqliteTable(
  "user_profiles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    avatarUrl: text("avatar_url"),
    preferredCurrency: text("preferred_currency", { enum: PREFERRED_CURRENCIES }).notNull().default("NPR"),
    language: text("language", { enum: LANGUAGES }).notNull().default("en_US"),
    monthlyStartDate: integer("monthly_start_date").notNull().default(1),
    notificationBudgetLimitAlerts: integer("notification_budget_limit_alerts", { mode: "boolean" })
      .notNull()
      .default(true),
    notificationGoalReminders: integer("notification_goal_reminders", { mode: "boolean" }).notNull().default(true),
    notificationWeeklySummaryEmails: integer("notification_weekly_summary_emails", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    userIdIndex: index("user_profiles_user_id_idx").on(table.userId),
    // drizzle-kit 0.24 does not emit CHECK constraints; the generated migration carries it by hand (plan BE-01).
    monthlyStartDateCheck: check(
      "user_profiles_monthly_start_date_check",
      sql`${table.monthlyStartDate} >= ${MONTHLY_START_DATE_MIN} AND ${table.monthlyStartDate} <= ${MONTHLY_START_DATE_MAX}`
    ),
  })
);

// Rate-limit ledger for `changePassword` (D-17); only failed credential checks are recorded.
export const passwordChangeAttempts = sqliteTable(
  "password_change_attempts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    attemptedAt: text("attempted_at").notNull(),
  },
  (table) => ({
    userIdAttemptedAtIndex: index("password_change_attempts_user_id_idx").on(table.userId, table.attemptedAt),
  })
);
