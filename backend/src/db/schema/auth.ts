import { sql } from "drizzle-orm";
import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const USER_PROVIDERS = ["email", "google"] as const;

// Timestamps are ISO-8601 UTC text; ids are UUIDs generated in code.
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash"),
    provider: text("provider", { enum: USER_PROVIDERS }).notNull(),
    googleId: text("google_id").unique(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    // drizzle-kit 0.24 does not emit CHECK constraints; the generated migration carries it by hand (plan BE-02).
    credentialCheck: check(
      "users_credential_check",
      sql`${table.passwordHash} IS NOT NULL OR ${table.googleId} IS NOT NULL`
    ),
  })
);

export const refreshTokens = sqliteTable(
  "refresh_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    userIdIndex: index("refresh_tokens_user_id_idx").on(table.userId),
  })
);

export const passwordResetTokens = sqliteTable(
  "password_reset_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: text("expires_at").notNull(),
    usedAt: text("used_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    userIdIndex: index("password_reset_tokens_user_id_idx").on(table.userId),
  })
);
