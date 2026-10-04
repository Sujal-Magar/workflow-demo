import { createExpressEndpoints, initServer } from "@ts-rest/express";
import { transactionsContract } from "@workflow-demo/contracts";
import express, { type Router } from "express";

import { handleRequestValidationError } from "../../shared/http/validation-error";
import { getAuthenticatedUserId, type RequireAuthMiddleware } from "../auth/require-auth";
import type { TransactionService } from "./transaction-service";

export interface TransactionRouterDependencies {
  readonly transactionService: TransactionService;
  readonly requireAuth: RequireAuthMiddleware;
}

const HTTP_CREATED = 201;

/**
 * The four `transactions` operations (contract §5–§6). Handlers stay thin: read the query, body,
 * or `:id`, call the service, return the declared status. Every route requires `requireAuth`.
 * Routes carry their full `/api/v1/transactions/...` path from the typed contract, so the router
 * is mounted without a prefix.
 */
export function createTransactionRouter(dependencies: TransactionRouterDependencies): Router {
  const { transactionService, requireAuth } = dependencies;
  const server = initServer();

  const routes = server.router(transactionsContract, {
    getTransactions: {
      middleware: [requireAuth],
      handler: async ({ req, query }) => {
        const result = transactionService.listTransactions(getAuthenticatedUserId(req), query);
        return { status: 200, body: result };
      },
    },
    createTransaction: {
      middleware: [requireAuth],
      handler: async ({ req, body }) => {
        const transaction = transactionService.createTransaction(getAuthenticatedUserId(req), body);
        return { status: HTTP_CREATED, body: transaction };
      },
    },
    updateTransaction: {
      middleware: [requireAuth],
      handler: async ({ req, params, body }) => {
        const transaction = transactionService.updateTransaction(getAuthenticatedUserId(req), params.id, body);
        return { status: 200, body: transaction };
      },
    },
    deleteTransaction: {
      middleware: [requireAuth],
      handler: async ({ req, params }) => {
        const userId = getAuthenticatedUserId(req);
        transactionService.deleteTransaction(userId, params.id);
        return { status: 200, body: { success: true, id: params.id } };
      },
    },
  });

  const router = express.Router();
  createExpressEndpoints(transactionsContract, routes, router, {
    requestValidationErrorHandler: handleRequestValidationError,
  });
  return router;
}
