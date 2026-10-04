"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getTransactions, type TransactionListQuery, type TransactionListResponse } from "../api/transactions-api";

export const TRANSACTIONS_QUERY_KEY = "transactions";

async function fetchTransactions(query: TransactionListQuery): Promise<TransactionListResponse> {
  const result = await getTransactions(query);
  if (!result.ok) {
    throw new Error(`Could not load transactions (${result.failure.kind}).`);
  }
  return result.data;
}

export function useTransactions(query: TransactionListQuery): UseQueryResult<TransactionListResponse> {
  return useQuery({
    queryKey: [TRANSACTIONS_QUERY_KEY, query],
    queryFn: () => fetchTransactions(query),
  });
}
