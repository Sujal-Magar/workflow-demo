import { and, count, eq, gt } from "drizzle-orm";

import type { DatabaseExecutor } from "../../db/client";
import { passwordChangeAttempts } from "../../db/schema";

export class PasswordChangeAttemptRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  /** Records one failed `currentPassword` check (contract §5.3 step 3). */
  recordFailure(id: string, userId: string, attemptedAt: Date): void {
    this.db
      .insert(passwordChangeAttempts)
      .values({ id, userId, attemptedAt: attemptedAt.toISOString() })
      .run();
  }

  /** Strictly-greater-than `since` (exclusive window start boundary, D-17): a failure recorded exactly at `since` does not count. */
  countFailuresSince(userId: string, since: Date): number {
    const row = this.db
      .select({ count: count() })
      .from(passwordChangeAttempts)
      .where(
        and(eq(passwordChangeAttempts.userId, userId), gt(passwordChangeAttempts.attemptedAt, since.toISOString()))
      )
      .get();
    return row?.count ?? 0;
  }
}
