import { and, eq, isNull } from "drizzle-orm";

import type { DatabaseExecutor } from "../../db/client";
import { refreshTokens } from "../../db/schema";

export interface RefreshTokenRecord {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
}

export interface NewRefreshToken {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

type RefreshTokenRow = typeof refreshTokens.$inferSelect;

function toRefreshTokenRecord(row: RefreshTokenRow): RefreshTokenRecord {
  return {
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    expiresAt: new Date(row.expiresAt),
    revokedAt: row.revokedAt === null ? null : new Date(row.revokedAt),
    createdAt: new Date(row.createdAt),
  };
}

export class RefreshTokenRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  createRefreshToken(token: NewRefreshToken): void {
    this.db
      .insert(refreshTokens)
      .values({
        id: token.id,
        userId: token.userId,
        tokenHash: token.tokenHash,
        expiresAt: token.expiresAt.toISOString(),
        createdAt: token.createdAt.toISOString(),
      })
      .run();
  }

  findByHash(tokenHash: string): RefreshTokenRecord | null {
    const row = this.db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash)).get();
    return row ? toRefreshTokenRecord(row) : null;
  }

  /** Revokes the token only if it is not revoked yet. Returns whether a row changed. */
  revokeIfActive(tokenId: string, revokedAt: Date): boolean {
    const result = this.db
      .update(refreshTokens)
      .set({ revokedAt: revokedAt.toISOString() })
      .where(and(eq(refreshTokens.id, tokenId), isNull(refreshTokens.revokedAt)))
      .run();
    return result.changes > 0;
  }

  /** Revokes every not-yet-revoked token of the user. Returns the number revoked. */
  revokeAllForUser(userId: string, revokedAt: Date): number {
    const result = this.db
      .update(refreshTokens)
      .set({ revokedAt: revokedAt.toISOString() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)))
      .run();
    return result.changes;
  }
}
