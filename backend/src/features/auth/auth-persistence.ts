import type { AppDatabase, DatabaseExecutor } from "../../db/client";
import { PasswordResetTokenRepository } from "./password-reset-token-repository";
import { RefreshTokenRepository } from "./refresh-token-repository";
import { UserRepository } from "./user-repository";

export interface AuthRepositories {
  readonly users: UserRepository;
  readonly refreshTokens: RefreshTokenRepository;
  readonly passwordResetTokens: PasswordResetTokenRepository;
}

function createRepositories(executor: DatabaseExecutor): AuthRepositories {
  return {
    users: new UserRepository(executor),
    refreshTokens: new RefreshTokenRepository(executor),
    passwordResetTokens: new PasswordResetTokenRepository(executor),
  };
}

/**
 * Unit of work for auth persistence. Outside a transaction the repositories run directly on the
 * database; `runInTransaction` hands the callback repositories bound to one transaction.
 */
export class AuthPersistence implements AuthRepositories {
  readonly users: UserRepository;
  readonly refreshTokens: RefreshTokenRepository;
  readonly passwordResetTokens: PasswordResetTokenRepository;

  constructor(private readonly db: AppDatabase) {
    const repositories = createRepositories(db);
    this.users = repositories.users;
    this.refreshTokens = repositories.refreshTokens;
    this.passwordResetTokens = repositories.passwordResetTokens;
  }

  /**
   * Runs `work` in one transaction. better-sqlite3 transactions are synchronous, so `work` must
   * not await; do async work (hashing, signing) before calling this. Throwing rolls back.
   */
  runInTransaction<T>(work: (repositories: AuthRepositories) => T): T {
    return this.db.transaction((transaction) => work(createRepositories(transaction)));
  }
}
