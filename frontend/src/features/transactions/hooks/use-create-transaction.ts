"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createTransaction, type CreateTransactionRequest, type Transaction } from "../api/transactions-api";
import type { TransactionResult } from "../lib/transaction-error";
import { TRANSACTIONS_QUERY_KEY } from "./use-transactions";

export function useCreateTransaction(): {
  submitCreateTransaction: (values: CreateTransactionRequest) => Promise<TransactionResult<Transaction>>;
  isPending: boolean;
} {
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: createTransaction,
    onSuccess: (result) => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_QUERY_KEY] });
      }
    },
  });
  return { submitCreateTransaction: mutateAsync, isPending };
}
