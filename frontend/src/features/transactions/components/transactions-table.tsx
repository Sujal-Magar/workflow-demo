import type { UserProfile } from "@workflow-demo/contracts";

import type { Transaction } from "../api/transactions-api";
import { TransactionRow } from "./transaction-row";

/** Decision D-13 (plan.md). */
const EMPTY_STATE_MESSAGE = "No transactions found for the selected filters.";

const COLUMN_HEADERS = ["Date", "Category", "Title", "Description", "Amount", "Type", "Actions"] as const;

interface TransactionsTableProps {
  transactions: readonly Transaction[];
  preferredCurrency: UserProfile["preferredCurrency"];
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
}

export function TransactionsTable({
  transactions,
  preferredCurrency,
  onEdit,
  onDelete,
}: Readonly<TransactionsTableProps>) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)]">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="bg-slate-100">
            {COLUMN_HEADERS.map((header) => (
              <th key={header} scope="col" className="px-4 py-4 text-sm font-semibold text-slate-600">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transactions.length === 0 ? (
            <tr>
              <td colSpan={COLUMN_HEADERS.length} className="px-4 py-10 text-center text-[15px] text-slate-500">
                {EMPTY_STATE_MESSAGE}
              </td>
            </tr>
          ) : (
            transactions.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                preferredCurrency={preferredCurrency}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
