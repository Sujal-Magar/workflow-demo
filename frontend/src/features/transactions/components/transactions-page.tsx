"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useProfile } from "@/features/profile/hooks/use-profile";

import type { Transaction, TransactionListQuery } from "../api/transactions-api";
import { useTransactions } from "../hooks/use-transactions";
import { AddTransactionDialog } from "./add-transaction-dialog";
import { DeleteTransactionDialog } from "./delete-transaction-dialog";
import { EditTransactionDialog } from "./edit-transaction-dialog";
import { PaginationControls } from "./pagination-controls";
import type { TransactionFiltersValue } from "./transaction-filters";
import { TransactionsTable } from "./transactions-table";
import { TransactionsToolbar } from "./transactions-toolbar";

const DEFAULT_LIMIT = 10;

/** behavior.md §1 defaults. */
const DEFAULT_FILTERS: TransactionFiltersValue = {
  timeframe: "this_month",
  category: "",
  type: "",
  sort: "newest",
};

function TransactionsPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading transactions" className="flex flex-col gap-4">
      <div className="h-12 w-72 animate-pulse rounded-md bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)]" />
      <div className="h-96 animate-pulse rounded-2xl bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)]" />
    </div>
  );
}

interface TransactionsPageErrorProps {
  onRetry: () => void;
}

/** Decision D-14 (plan.md). */
function TransactionsPageError({ onRetry }: Readonly<TransactionsPageErrorProps>) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)]">
      <p className="text-[15px] text-slate-700">Couldn&apos;t load your transactions. Please try again.</p>
      <Button onClick={onRetry}>Retry</Button>
    </div>
  );
}

/** Owns filter/pagination state and the top-level loading/error/empty states (plan FE-02). No shared nav/header (D-11). */
export function TransactionsPage() {
  const { data: profile } = useProfile();
  const [filters, setFilters] = useState<TransactionFiltersValue>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);

  const query: TransactionListQuery = {
    page,
    limit: DEFAULT_LIMIT,
    sort: filters.sort,
    timeframe: filters.timeframe,
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.type ? { type: filters.type } : {}),
  };

  const { data, isPending, isError, refetch } = useTransactions(query);

  const handleFiltersChange = (nextFilters: TransactionFiltersValue) => {
    setFilters(nextFilters);
    setPage(1);
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <TransactionsToolbar
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onAddClick={() => setIsAddOpen(true)}
        />
        {isPending ? <TransactionsPageSkeleton /> : null}
        {!isPending && isError ? <TransactionsPageError onRetry={() => void refetch()} /> : null}
        {!isPending && !isError && data && profile ? (
          <>
            <TransactionsTable
              transactions={data.data}
              preferredCurrency={profile.preferredCurrency}
              onEdit={setEditingTransaction}
              onDelete={setDeletingTransaction}
            />
            <PaginationControls page={page} total={data.total} limit={DEFAULT_LIMIT} onPageChange={setPage} />
          </>
        ) : null}
      </div>

      <AddTransactionDialog open={isAddOpen} onOpenChange={setIsAddOpen} />
      {editingTransaction ? (
        <EditTransactionDialog
          transaction={editingTransaction}
          open={Boolean(editingTransaction)}
          onOpenChange={(open) => {
            if (!open) {
              setEditingTransaction(null);
            }
          }}
        />
      ) : null}
      {deletingTransaction ? (
        <DeleteTransactionDialog
          transaction={deletingTransaction}
          open={Boolean(deletingTransaction)}
          onOpenChange={(open) => {
            if (!open) {
              setDeletingTransaction(null);
            }
          }}
        />
      ) : null}
    </main>
  );
}

export type { TransactionFiltersValue };
