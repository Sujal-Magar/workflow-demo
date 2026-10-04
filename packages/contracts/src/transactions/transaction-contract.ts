import { initContract } from "@ts-rest/core";

import { errorBodySchema } from "../common/error-body";
import {
  deleteTransactionResponseSchema,
  transactionListResponseSchema,
  transactionSchema,
} from "./transaction-shapes";
import {
  createTransactionRequestSchema,
  transactionListQuerySchema,
  updateTransactionRequestSchema,
} from "./transaction-validation";

export const TRANSACTIONS_BASE_PATH = "/api/v1/transactions";

const c = initContract();

/**
 * The four `transactions` operations (contract.md §5–§6). Every route carries the full
 * `/api/v1/transactions/...` path, and every status an operation may return is declared.
 */
export const transactionsContract = c.router(
  {
    getTransactions: {
      method: "GET",
      path: "/",
      query: transactionListQuerySchema,
      responses: {
        200: transactionListResponseSchema,
        400: errorBodySchema,
        401: errorBodySchema,
        500: errorBodySchema,
      },
      summary: "List the caller's transactions, paginated and filtered",
    },
    createTransaction: {
      method: "POST",
      path: "/",
      body: createTransactionRequestSchema,
      responses: {
        201: transactionSchema,
        400: errorBodySchema,
        401: errorBodySchema,
        500: errorBodySchema,
      },
      summary: "Add a new income or expense record",
    },
    updateTransaction: {
      method: "PUT",
      path: "/:id",
      body: updateTransactionRequestSchema,
      responses: {
        200: transactionSchema,
        400: errorBodySchema,
        401: errorBodySchema,
        404: errorBodySchema,
        500: errorBodySchema,
      },
      summary: "Edit an existing transaction (full replace of the editable fields)",
    },
    deleteTransaction: {
      method: "DELETE",
      path: "/:id",
      body: c.noBody(),
      responses: {
        200: deleteTransactionResponseSchema,
        401: errorBodySchema,
        404: errorBodySchema,
        500: errorBodySchema,
      },
      summary: "Permanently remove a transaction",
    },
  },
  {
    pathPrefix: TRANSACTIONS_BASE_PATH,
    strictStatusCodes: true,
  }
);

export type TransactionsContract = typeof transactionsContract;
