import { cn } from "@/lib/cn";

import type { TransactionType } from "../api/transactions-api";

export const TRANSACTION_TYPE_LABELS: Readonly<Record<TransactionType, string>> = {
  income: "Income",
  expense: "Expense",
};

interface TransactionTypeBadgeProps {
  type: TransactionType;
}

export function TransactionTypeBadge({ type }: Readonly<TransactionTypeBadgeProps>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        type === "income" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
      )}
    >
      {TRANSACTION_TYPE_LABELS[type]}
    </span>
  );
}
