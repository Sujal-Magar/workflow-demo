import { and, eq, isNull } from "drizzle-orm";

import type { DatabaseExecutor } from "../../db/client";
import { passwordResetTokens } from "../../db/schema";

export interface PasswordResetTokenRecord {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly usedAt: Date | null;
  readonly createdAt: Date;
}

export interface NewPasswordResetToken {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

type PasswordResetTokenRow = typeof passwordResetTokens.$inferSelect;

function toPasswordResetTokenRecord(row: PasswordResetTokenRow): PasswordResetTokenRecord {
  return {
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    expiresAt: new Date(row.expiresAt),
    usedAt: row.usedAt === null ? null : new Date(row.usedAt),
    createdAt: new Date(row.createdAt),
  };
}

export class PasswordResetTokenRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  /** Marks every unused token of the user as used. Already-used tokens keep their `used_at`. */
  invalidateUnusedForUser(userId: string, usedAt: Date): number {
    const result = this.db
      .update(passwordResetTokens)
      .set({ usedAt: usedAt.toISOString() })
      .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)))
      .run();
    return result.changes;
  }

  createResetToken(token: NewPasswordResetToken): void {
    this.db
      .insert(passwordResetTokens)
      .values({
        id: token.id,
        userId: token.userId,
        tokenHash: token.tokenHash,
        expiresAt: token.expiresAt.toISOString(),
        createdAt: token.createdAt.toISOString(),
      })
      .run();
  }

  findByHash(tokenHash: string): PasswordResetTokenRecord | null {
    const row = this.db.select().from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash)).get();
    return row ? toPasswordResetTokenRecord(row) : null;
  }

  /** Marks the token used only if it is still unused. Returns whether a row changed. */
  markUsedIfUnused(tokenId: string, usedAt: Date): boolean {
    const result = this.db
      .update(passwordResetTokens)
      .set({ usedAt: usedAt.toISOString() })
      .where(and(eq(passwordResetTokens.id, tokenId), isNull(passwordResetTokens.usedAt)))
      .run();
    return result.changes > 0;
  }
}
