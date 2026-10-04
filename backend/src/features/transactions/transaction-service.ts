import type {
  CreateTransactionRequest,
  Transaction,
  TransactionListQuery,
  UpdateTransactionRequest,
} from "@workflow-demo/contracts";
import { randomUUID } from "node:crypto";

import type { Clock } from "../../shared/clock";
import { DEFAULT_LIMIT, DEFAULT_PAGE } from "./transaction-constants";
import { TransactionNotFoundError } from "./transaction-errors";
import type {
  TransactionCategory,
  TransactionRecord,
  TransactionRepository,
  TransactionSort,
  TransactionType,
} from "./transaction-repository";

export interface TransactionServiceDependencies {
  readonly transactionRepository: TransactionRepository;
  readonly clock: Clock;
}

export interface TransactionListResult {
  readonly data: Transaction[];
  readonly total: number;
}

function toTransaction(record: TransactionRecord): Transaction {
  return {
    id: record.id,
    date: record.date,
    description: record.description,
    category: record.category,
    type: record.type,
    amount: record.amount,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The most recent Monday relative to `now` (ISO-8601 Monday-start week, D-06). */
function startOfWeekMonday(now: Date): Date {
  const weekday = now.getUTCDay(); // 0 = Sunday … 6 = Saturday
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday));
}

interface DateWindow {
  readonly dateFrom?: string;
  readonly dateTo?: string;
}

/** Resolves `timeframe` to a concrete `[dateFrom, dateTo)` window using `clock.now()` (D-06). */
function resolveDateWindow(timeframe: TransactionListQuery["timeframe"], now: Date): DateWindow {
  switch (timeframe) {
    case "this_week": {
      const monday = startOfWeekMonday(now);
      const nextMonday = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 7));
      return { dateFrom: formatDate(monday), dateTo: formatDate(nextMonday) };
    }
    case "this_month": {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      return { dateFrom: formatDate(start), dateTo: formatDate(end) };
    }
    case "this_year": {
      const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      const end = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));
      return { dateFrom: formatDate(start), dateTo: formatDate(end) };
    }
    case "all_time":
    default:
      return {};
  }
}

/** Business rules for the transactions ledger: list (filtered/paginated), create, update, delete. */
export class TransactionService {
  constructor(private readonly dependencies: TransactionServiceDependencies) {}

  listTransactions(userId: string, query: TransactionListQuery): TransactionListResult {
    const { transactionRepository, clock } = this.dependencies;
    const { dateFrom, dateTo } = resolveDateWindow(query.timeframe, clock.now());
    const filter = {
      category: query.category as TransactionCategory | undefined,
      type: query.type as TransactionType | undefined,
      dateFrom,
      dateTo,
      sort: query.sort as TransactionSort,
    };
    const pagination = { page: query.page ?? DEFAULT_PAGE, limit: query.limit ?? DEFAULT_LIMIT };
    const data = transactionRepository.findManyByUserId(userId, filter, pagination).map(toTransaction);
    const total = transactionRepository.countByUserId(userId, filter);
    return { data, total };
  }

  createTransaction(userId: string, input: CreateTransactionRequest): Transaction {
    const { transactionRepository, clock } = this.dependencies;
    const now = clock.now();
    const record = transactionRepository.create({
      id: randomUUID(),
      userId,
      date: input.date,
      description: input.description,
      category: input.category as TransactionCategory,
      type: input.type as TransactionType,
      amount: input.amount,
      createdAt: now,
    });
    return toTransaction(record);
  }

  /** Full replace of the editable fields (D-01); `null` from the repository → `TransactionNotFoundError` (D-02). */
  updateTransaction(userId: string, id: string, input: UpdateTransactionRequest): Transaction {
    const { transactionRepository, clock } = this.dependencies;
    const record = transactionRepository.update(
      id,
      userId,
      {
        date: input.date,
        description: input.description,
        category: input.category as TransactionCategory,
        type: input.type as TransactionType,
        amount: input.amount,
      },
      clock.now()
    );
    if (record === null) {
      throw new TransactionNotFoundError();
    }
    return toTransaction(record);
  }

  deleteTransaction(userId: string, id: string): void {
    const deleted = this.dependencies.transactionRepository.deleteById(id, userId);
    if (!deleted) {
      throw new TransactionNotFoundError();
    }
  }
}
