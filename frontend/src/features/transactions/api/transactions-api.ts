// The single module through which every transactions hook reaches the API (plan FE-08).
// Mock-backed in Phase 5 Build (no backend coupling yet); Integration (plan INT-01) replaces the four
// functions' bodies with a real `@workflow-demo/contracts` ts-rest client. Their signatures, and the types
// below (eventually re-exported from the contracts package instead of declared here), stay unchanged.
import { ERROR_CODES } from "@workflow-demo/contracts";

import { toTransactionFailure, type TransactionResult } from "../lib/transaction-error";
import { MOCK_TRANSACTIONS } from "../test/mock-transactions";

export const CATEGORIES = [
  "food_and_dining",
  "salary",
  "transportation",
  "shopping",
  "investment",
  "freelance_work",
  "bills_and_utilities",
  "health_and_fitness",
  "savings_account",
  "others",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const TRANSACTION_TYPES = ["income", "expense"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TIMEFRAMES = ["this_week", "this_month", "this_year", "all_time"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export const SORTS = ["newest", "oldest"] as const;
export type Sort = (typeof SORTS)[number];

export interface Transaction {
  readonly id: string;
  readonly date: string;
  readonly description: string;
  readonly category: Category;
  readonly type: TransactionType;
  readonly amount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TransactionListQuery {
  readonly page?: number;
  readonly limit?: number;
  readonly category?: Category;
  readonly type?: TransactionType;
  readonly timeframe?: Timeframe;
  readonly sort?: Sort;
}

export interface TransactionListResponse {
  readonly data: readonly Transaction[];
  readonly total: number;
}

export interface CreateTransactionRequest {
  readonly date: string;
  readonly description: string;
  readonly category: Category;
  readonly type: TransactionType;
  readonly amount: number;
}

export type UpdateTransactionRequest = CreateTransactionRequest;

export interface DeleteTransactionResponse {
  readonly success: true;
  readonly id: string;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MOCK_LATENCY_MS = 250;

let mockTransactions: Transaction[] = MOCK_TRANSACTIONS.map((transaction) => ({ ...transaction }));

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createMockId(): string {
  return `txn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseCalendarDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** The ISO-8601 Monday-start week containing `reference` (plan Decision D-06). */
function startOfWeekMonday(reference: Date): Date {
  const weekday = reference.getUTCDay();
  const diffToMonday = (weekday + 6) % 7;
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate() - diffToMonday));
}

function resolveDateWindow(timeframe: Timeframe, now: Date): { from: Date | null; to: Date | null } {
  if (timeframe === "all_time") {
    return { from: null, to: null };
  }
  if (timeframe === "this_week") {
    const from = startOfWeekMonday(now);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 7);
    return { from, to };
  }
  if (timeframe === "this_month") {
    return {
      from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      to: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
    };
  }
  return {
    from: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)),
    to: new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1)),
  };
}

function matchesFilter(transaction: Transaction, query: TransactionListQuery, timeframe: Timeframe): boolean {
  if (query.category && transaction.category !== query.category) {
    return false;
  }
  if (query.type && transaction.type !== query.type) {
    return false;
  }
  const { from, to } = resolveDateWindow(timeframe, new Date());
  if (from && to) {
    const transactionDate = parseCalendarDate(transaction.date);
    if (transactionDate < from || transactionDate >= to) {
      return false;
    }
  }
  return true;
}

function sortTransactions(data: readonly Transaction[], sort: Sort): Transaction[] {
  const direction = sort === "newest" ? -1 : 1;
  return [...data].sort((a, b) => {
    if (a.date !== b.date) {
      return a.date < b.date ? direction : -direction;
    }
    // Tie-break for rows sharing the same `date` (contract.md §2.3, D-07): createdAt DESC under "newest", ASC under "oldest".
    return a.createdAt < b.createdAt ? direction : -direction;
  });
}

export async function getTransactions(
  query: TransactionListQuery
): Promise<TransactionResult<TransactionListResponse>> {
  await wait(MOCK_LATENCY_MS);
  const timeframe = query.timeframe ?? "this_month";
  const sort = query.sort ?? "newest";
  const page = query.page ?? DEFAULT_PAGE;
  const limit = query.limit ?? DEFAULT_LIMIT;
  const filtered = mockTransactions.filter((transaction) => matchesFilter(transaction, query, timeframe));
  const sorted = sortTransactions(filtered, sort);
  const start = (page - 1) * limit;
  const data = sorted.slice(start, start + limit);
  return { ok: true, data: { data, total: filtered.length } };
}

export async function createTransaction(body: CreateTransactionRequest): Promise<TransactionResult<Transaction>> {
  await wait(MOCK_LATENCY_MS);
  const now = new Date().toISOString();
  const created: Transaction = { id: createMockId(), ...body, createdAt: now, updatedAt: now };
  mockTransactions = [created, ...mockTransactions];
  return { ok: true, data: created };
}

export async function updateTransaction(
  id: string,
  body: UpdateTransactionRequest
): Promise<TransactionResult<Transaction>> {
  await wait(MOCK_LATENCY_MS);
  const index = mockTransactions.findIndex((transaction) => transaction.id === id);
  if (index === -1) {
    return {
      ok: false,
      failure: toTransactionFailure("updateTransaction", {
        kind: "response",
        status: 404,
        body: { code: ERROR_CODES.NOT_FOUND, message: "Transaction not found." },
      }),
    };
  }
  const updated: Transaction = { ...mockTransactions[index], ...body, updatedAt: new Date().toISOString() };
  mockTransactions = [...mockTransactions.slice(0, index), updated, ...mockTransactions.slice(index + 1)];
  return { ok: true, data: updated };
}

export async function deleteTransaction(id: string): Promise<TransactionResult<DeleteTransactionResponse>> {
  await wait(MOCK_LATENCY_MS);
  const exists = mockTransactions.some((transaction) => transaction.id === id);
  if (!exists) {
    return {
      ok: false,
      failure: toTransactionFailure("deleteTransaction", {
        kind: "response",
        status: 404,
        body: { code: ERROR_CODES.NOT_FOUND, message: "Transaction not found." },
      }),
    };
  }
  mockTransactions = mockTransactions.filter((transaction) => transaction.id !== id);
  return { ok: true, data: { success: true, id } };
}
