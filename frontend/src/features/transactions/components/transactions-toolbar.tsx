"use client";

import { Button } from "@/components/ui/button";

import { TransactionFilters, type TransactionFiltersValue } from "./transaction-filters";

interface TransactionsToolbarProps {
  filters: TransactionFiltersValue;
  onFiltersChange: (value: TransactionFiltersValue) => void;
  onAddClick: () => void;
}

export function TransactionsToolbar({ filters, onFiltersChange, onAddClick }: Readonly<TransactionsToolbarProps>) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold text-brand-ink">Transactions</h1>
        <Button onClick={onAddClick}>+ Add Transaction</Button>
      </div>
      <TransactionFilters value={filters} onChange={onFiltersChange} />
    </div>
  );
}
