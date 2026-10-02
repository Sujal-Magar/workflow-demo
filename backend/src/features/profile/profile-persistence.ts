import type { AppDatabase, DatabaseExecutor } from "../../db/client";
import { PasswordChangeAttemptRepository } from "./password-change-attempt-repository";
import { ProfileRepository } from "./profile-repository";

export interface ProfileRepositories {
  readonly profiles: ProfileRepository;
  readonly passwordChangeAttempts: PasswordChangeAttemptRepository;
}

function createRepositories(executor: DatabaseExecutor): ProfileRepositories {
  return {
    profiles: new ProfileRepository(executor),
    passwordChangeAttempts: new PasswordChangeAttemptRepository(executor),
  };
}

/**
 * Unit of work for profile persistence. Outside a transaction the repositories run directly on
 * the database; `runInTransaction` hands the callback repositories bound to one transaction.
 * Mirrors `AuthPersistence`'s shape exactly.
 */
export class ProfilePersistence implements ProfileRepositories {
  readonly profiles: ProfileRepository;
  readonly passwordChangeAttempts: PasswordChangeAttemptRepository;

  constructor(private readonly db: AppDatabase) {
    const repositories = createRepositories(db);
    this.profiles = repositories.profiles;
    this.passwordChangeAttempts = repositories.passwordChangeAttempts;
  }

  /**
   * Runs `work` in one transaction. better-sqlite3 transactions are synchronous, so `work` must
   * not await; do async work (hashing) before calling this. Throwing rolls back.
   */
  runInTransaction<T>(work: (repositories: ProfileRepositories) => T): T {
    return this.db.transaction((transaction) => work(createRepositories(transaction)));
  }
}
