"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteTransaction, type DeleteTransactionResponse } from "../api/transactions-api";
import type { TransactionResult } from "../lib/transaction-error";
import { TRANSACTIONS_QUERY_KEY } from "./use-transactions";

export function useDeleteTransaction(): {
  submitDeleteTransaction: (id: string) => Promise<TransactionResult<DeleteTransactionResponse>>;
  isPending: boolean;
} {
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: deleteTransaction,
    onSuccess: (result) => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_QUERY_KEY] });
      }
    },
  });
  return { submitDeleteTransaction: mutateAsync, isPending };
}
