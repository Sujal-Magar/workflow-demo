import { SqliteError } from "better-sqlite3";
import { eq } from "drizzle-orm";

import type { DatabaseExecutor } from "../../db/client";
import { users } from "../../db/schema";

export type UserProvider = "email" | "google";

export interface UserRecord {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly passwordHash: string | null;
  readonly provider: UserProvider;
  readonly googleId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly passwordHash: string | null;
  readonly provider: UserProvider;
  readonly googleId: string | null;
  readonly createdAt: Date;
}

export type CreateUserResult =
  { readonly status: "created"; readonly user: UserRecord } | { readonly status: "email-taken" };

type UserRow = typeof users.$inferSelect;

const SQLITE_UNIQUE_VIOLATION = "SQLITE_CONSTRAINT_UNIQUE";
const EMAIL_UNIQUE_TARGET = "users.email";

function toUserRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.passwordHash,
    provider: row.provider,
    googleId: row.googleId,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function isEmailUniqueViolation(error: unknown): boolean {
  return (
    error instanceof SqliteError &&
    error.code === SQLITE_UNIQUE_VIOLATION &&
    error.message.includes(EMAIL_UNIQUE_TARGET)
  );
}

export class UserRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  findById(id: string): UserRecord | null {
    const row = this.db.select().from(users).where(eq(users.id, id)).get();
    return row ? toUserRecord(row) : null;
  }

  findByEmail(email: string): UserRecord | null {
    const row = this.db.select().from(users).where(eq(users.email, email)).get();
    return row ? toUserRecord(row) : null;
  }

  findByGoogleId(googleId: string): UserRecord | null {
    const row = this.db.select().from(users).where(eq(users.googleId, googleId)).get();
    return row ? toUserRecord(row) : null;
  }

  /** Inserts a user. An email UNIQUE violation is reported as `email-taken`, never thrown. */
  createUser(newUser: NewUser): CreateUserResult {
    const timestamp = newUser.createdAt.toISOString();
    try {
      const row = this.db
        .insert(users)
        .values({
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          passwordHash: newUser.passwordHash,
          provider: newUser.provider,
          googleId: newUser.googleId,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .returning()
        .get();
      return { status: "created", user: toUserRecord(row) };
    } catch (error) {
      if (isEmailUniqueViolation(error)) {
        return { status: "email-taken" };
      }
      throw error;
    }
  }

  linkGoogleId(userId: string, googleId: string, updatedAt: Date): void {
    this.db.update(users).set({ googleId, updatedAt: updatedAt.toISOString() }).where(eq(users.id, userId)).run();
  }

  updatePasswordHash(userId: string, passwordHash: string, updatedAt: Date): void {
    this.db.update(users).set({ passwordHash, updatedAt: updatedAt.toISOString() }).where(eq(users.id, userId)).run();
  }

  /** `profile`'s `updateUserProfile` writes the account's display name through this method (plan D-12). */
  updateName(userId: string, name: string, updatedAt: Date): void {
    this.db.update(users).set({ name, updatedAt: updatedAt.toISOString() }).where(eq(users.id, userId)).run();
  }
}
