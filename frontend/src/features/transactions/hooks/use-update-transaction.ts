"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateTransaction, type Transaction, type UpdateTransactionRequest } from "../api/transactions-api";
import type { TransactionResult } from "../lib/transaction-error";
import { TRANSACTIONS_QUERY_KEY } from "./use-transactions";

interface UpdateTransactionVariables {
  readonly id: string;
  readonly body: UpdateTransactionRequest;
}

export function useUpdateTransaction(): {
  submitUpdateTransaction: (values: UpdateTransactionVariables) => Promise<TransactionResult<Transaction>>;
  isPending: boolean;
} {
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: ({ id, body }: UpdateTransactionVariables) => updateTransaction(id, body),
    onSuccess: (result) => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_QUERY_KEY] });
      }
    },
  });
  return { submitUpdateTransaction: mutateAsync, isPending };
}
