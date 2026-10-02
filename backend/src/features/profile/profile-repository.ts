import { eq } from "drizzle-orm";

import type { DatabaseExecutor } from "../../db/client";
import { userProfiles } from "../../db/schema";

type ProfileRow = typeof userProfiles.$inferSelect;

export type PreferredCurrency = ProfileRow["preferredCurrency"];
export type Language = ProfileRow["language"];

export interface ProfileRecord {
  readonly id: string;
  readonly userId: string;
  readonly avatarUrl: string | null;
  readonly preferredCurrency: PreferredCurrency;
  readonly language: Language;
  readonly monthlyStartDate: number;
  readonly notificationBudgetLimitAlerts: boolean;
  readonly notificationGoalReminders: boolean;
  readonly notificationWeeklySummaryEmails: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewProfile {
  readonly id: string;
  readonly userId: string;
  readonly createdAt: Date;
}

/** Only `avatarUrl` and the notification flags are patchable; `preferredCurrency`, `language` and `monthlyStartDate` are read-only in v1.0.0 (D-05). */
export interface ProfilePatch {
  readonly avatarUrl?: string;
  readonly notificationBudgetLimitAlerts?: boolean;
  readonly notificationGoalReminders?: boolean;
  readonly notificationWeeklySummaryEmails?: boolean;
}

function toProfileRecord(row: ProfileRow): ProfileRecord {
  return {
    id: row.id,
    userId: row.userId,
    avatarUrl: row.avatarUrl,
    preferredCurrency: row.preferredCurrency,
    language: row.language,
    monthlyStartDate: row.monthlyStartDate,
    notificationBudgetLimitAlerts: row.notificationBudgetLimitAlerts,
    notificationGoalReminders: row.notificationGoalReminders,
    notificationWeeklySummaryEmails: row.notificationWeeklySummaryEmails,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

export class ProfileRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  findByUserId(userId: string): ProfileRecord | null {
    const row = this.db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).get();
    return row ? toProfileRecord(row) : null;
  }

  /** Inserts a profile row with baseline defaults (D-11); only `id`, `userId` and `createdAt` are explicit. */
  create(newProfile: NewProfile): ProfileRecord {
    const timestamp = newProfile.createdAt.toISOString();
    const row = this.db
      .insert(userProfiles)
      .values({
        id: newProfile.id,
        userId: newProfile.userId,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning()
      .get();
    return toProfileRecord(row);
  }

  /** Partial update of `avatarUrl` / notification flags only; `preferredCurrency`/`language`/`monthlyStartDate` are never touched. */
  update(userId: string, patch: ProfilePatch, updatedAt: Date): ProfileRecord {
    const row = this.db
      .update(userProfiles)
      .set({ ...patch, updatedAt: updatedAt.toISOString() })
      .where(eq(userProfiles.userId, userId))
      .returning()
      .get();
    return toProfileRecord(row);
  }

  /** Resets to the same baseline defaults as `create`, preserving `id` and `createdAt` (contract §5.5, D-01). */
  resetToDefaults(userId: string, updatedAt: Date): ProfileRecord {
    const row = this.db
      .update(userProfiles)
      .set({
        avatarUrl: null,
        preferredCurrency: "NPR",
        language: "en_US",
        monthlyStartDate: 1,
        notificationBudgetLimitAlerts: true,
        notificationGoalReminders: true,
        notificationWeeklySummaryEmails: true,
        updatedAt: updatedAt.toISOString(),
      })
      .where(eq(userProfiles.userId, userId))
      .returning()
      .get();
    return toProfileRecord(row);
  }
}
