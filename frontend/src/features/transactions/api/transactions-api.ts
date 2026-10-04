// The single module through which every transactions hook reaches the API (plan FE-08).
// Switched to the real ts-rest client in Integration (plan INT-01); hook signatures and callers do not change.
import type { ZodType } from "zod";

import {
  deleteTransactionResponseSchema,
  TRANSACTION_CATEGORIES,
  TRANSACTION_SORTS,
  TRANSACTION_TIMEFRAMES,
  TRANSACTION_TYPES,
  transactionListResponseSchema,
  transactionSchema,
  type DeleteTransactionResponse,
  type Transaction,
  type TransactionListResponse,
} from "@workflow-demo/contracts";

import { transactionsApiClient } from "@/lib/api-client";

import { toTransactionFailure, type TransactionOperation, type TransactionResult } from "../lib/transaction-error";

export { TRANSACTION_CATEGORIES as CATEGORIES, TRANSACTION_TYPES } from "@workflow-demo/contracts";
export type { DeleteTransactionResponse, Transaction, TransactionListResponse } from "@workflow-demo/contracts";

export type Category = (typeof TRANSACTION_CATEGORIES)[number];
export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export type Timeframe = (typeof TRANSACTION_TIMEFRAMES)[number];
export type Sort = (typeof TRANSACTION_SORTS)[number];

/**
 * The contract's request types are inferred from its parsing schemas, whose outputs widen the enum fields to
 * `string`. These narrow them back to the contract's own enums so callers can only build a request it accepts.
 */
export interface TransactionListQuery {
  readonly page?: number;
  readonly limit?: number;
  readonly category?: Category;
  readonly type?: TransactionType;
  readonly timeframe?: Timeframe;
  readonly sort?: Sort;
}

export type CreateTransactionRequest = Pick<Transaction, "date" | "description" | "category" | "type" | "amount">;

export type UpdateTransactionRequest = CreateTransactionRequest;

const HTTP_OK = 200;
const HTTP_CREATED = 201;

interface RawResponse {
  readonly status: number;
  readonly body: unknown;
}

interface OperationSpec<T> {
  readonly operation: TransactionOperation;
  readonly successStatus: number;
  readonly successSchema: ZodType<T>;
}

async function runOperation<T>(
  spec: OperationSpec<T>,
  send: () => Promise<RawResponse>
): Promise<TransactionResult<T>> {
  let response: RawResponse;
  try {
    response = await send();
  } catch {
    // No response at all (network failure): the caller applies the generic failure feedback.
    return { ok: false, failure: toTransactionFailure(spec.operation, { kind: "network-error" }) };
  }
  if (response.status === spec.successStatus) {
    const parsed = spec.successSchema.safeParse(response.body);
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false, failure: { kind: "unexpected" } };
  }
  return {
    ok: false,
    failure: toTransactionFailure(spec.operation, {
      kind: "response",
      status: response.status,
      body: response.body,
    }),
  };
}

export function getTransactions(query: TransactionListQuery): Promise<TransactionResult<TransactionListResponse>> {
  return runOperation(
    { operation: "getTransactions", successStatus: HTTP_OK, successSchema: transactionListResponseSchema },
    () => transactionsApiClient.getTransactions.query({ query })
  );
}

export function createTransaction(body: CreateTransactionRequest): Promise<TransactionResult<Transaction>> {
  return runOperation(
    { operation: "createTransaction", successStatus: HTTP_CREATED, successSchema: transactionSchema },
    () => transactionsApiClient.createTransaction.mutate({ body })
  );
}

export function updateTransaction(id: string, body: UpdateTransactionRequest): Promise<TransactionResult<Transaction>> {
  return runOperation(
    { operation: "updateTransaction", successStatus: HTTP_OK, successSchema: transactionSchema },
    () => transactionsApiClient.updateTransaction.mutate({ params: { id }, body })
  );
}

export function deleteTransaction(id: string): Promise<TransactionResult<DeleteTransactionResponse>> {
  return runOperation(
    { operation: "deleteTransaction", successStatus: HTTP_OK, successSchema: deleteTransactionResponseSchema },
    () => transactionsApiClient.deleteTransaction.mutate({ params: { id } })
  );
}
