import { and, asc, count, desc, eq, gte, lt } from "drizzle-orm";

import type { DatabaseExecutor } from "../../db/client";
import { transactions } from "../../db/schema";

type TransactionRow = typeof transactions.$inferSelect;

export type TransactionCategory = TransactionRow["category"];
export type TransactionType = TransactionRow["type"];
export type TransactionSort = "newest" | "oldest";

export interface TransactionRecord {
  readonly id: string;
  readonly userId: string;
  readonly date: string;
  readonly description: string;
  readonly category: TransactionCategory;
  readonly type: TransactionType;
  readonly amount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewTransaction {
  readonly id: string;
  readonly userId: string;
  readonly date: string;
  readonly description: string;
  readonly category: TransactionCategory;
  readonly type: TransactionType;
  readonly amount: number;
  readonly createdAt: Date;
}

/** Full replace of the editable fields — never a partial patch (D-01). */
export interface TransactionUpdate {
  readonly date: string;
  readonly description: string;
  readonly category: TransactionCategory;
  readonly type: TransactionType;
  readonly amount: number;
}

/** An already-resolved date window; resolving `timeframe` into `dateFrom`/`dateTo` is a Service-layer concern. */
export interface TransactionFilter {
  readonly category?: TransactionCategory;
  readonly type?: TransactionType;
  /** Inclusive (`YYYY-MM-DD`). */
  readonly dateFrom?: string;
  /** Exclusive (`YYYY-MM-DD`). */
  readonly dateTo?: string;
  readonly sort: TransactionSort;
}

export interface Pagination {
  readonly page: number;
  readonly limit: number;
}

function toTransactionRecord(row: TransactionRow): TransactionRecord {
  return {
    id: row.id,
    userId: row.userId,
    date: row.date,
    description: row.description,
    category: row.category,
    type: row.type,
    amount: row.amount,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

export class TransactionRepository {
  constructor(private readonly db: DatabaseExecutor) {}

  /** Scoped by both `id` and `userId` — a cross-user id can never be read (D-02). */
  findById(id: string, userId: string): TransactionRecord | null {
    const row = this.db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .get();
    return row ? toTransactionRecord(row) : null;
  }

  findManyByUserId(userId: string, filter: TransactionFilter, pagination: Pagination): TransactionRecord[] {
    const orderColumns =
      filter.sort === "newest"
        ? [desc(transactions.date), desc(transactions.createdAt)]
        : [asc(transactions.date), asc(transactions.createdAt)];
    const rows = this.db
      .select()
      .from(transactions)
      .where(this.whereClause(userId, filter))
      .orderBy(...orderColumns)
      .limit(pagination.limit)
      .offset((pagination.page - 1) * pagination.limit)
      .all();
    return rows.map(toTransactionRecord);
  }

  /** Same predicate as `findManyByUserId`, no pagination — drives `total` (contract §2.3). */
  countByUserId(userId: string, filter: TransactionFilter): number {
    const row = this.db.select({ count: count() }).from(transactions).where(this.whereClause(userId, filter)).get();
    return row?.count ?? 0;
  }

  create(newTransaction: NewTransaction): TransactionRecord {
    const timestamp = newTransaction.createdAt.toISOString();
    const row = this.db
      .insert(transactions)
      .values({
        id: newTransaction.id,
        userId: newTransaction.userId,
        date: newTransaction.date,
        description: newTransaction.description,
        category: newTransaction.category,
        type: newTransaction.type,
        amount: newTransaction.amount,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning()
      .get();
    return toTransactionRecord(row);
  }

  /** `null` if the scoped row doesn't exist (caller maps to `TransactionNotFoundError`, D-02). */
  update(id: string, userId: string, patch: TransactionUpdate, updatedAt: Date): TransactionRecord | null {
    const row = this.db
      .update(transactions)
      .set({ ...patch, updatedAt: updatedAt.toISOString() })
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .returning()
      .get();
    return row ? toTransactionRecord(row) : null;
  }

  /** Whether a row was actually deleted (D-02). */
  deleteById(id: string, userId: string): boolean {
    const result = this.db
      .delete(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .run();
    return result.changes > 0;
  }

  private whereClause(userId: string, filter: TransactionFilter) {
    const conditions = [eq(transactions.userId, userId)];
    if (filter.category !== undefined) {
      conditions.push(eq(transactions.category, filter.category));
    }
    if (filter.type !== undefined) {
      conditions.push(eq(transactions.type, filter.type));
    }
    if (filter.dateFrom !== undefined) {
      conditions.push(gte(transactions.date, filter.dateFrom));
    }
    if (filter.dateTo !== undefined) {
      conditions.push(lt(transactions.date, filter.dateTo));
    }
    return and(...conditions);
  }
}
