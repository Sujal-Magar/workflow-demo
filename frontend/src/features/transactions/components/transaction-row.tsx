import type { UserProfile } from "@workflow-demo/contracts";

import { EditIcon, TrashIcon } from "@/components/ui/icons";
import { CURRENCY_SYMBOLS } from "@/lib/currency";

import type { Transaction } from "../api/transactions-api";
import { CATEGORY_LABELS, CategoryIcon } from "./category-icon";
import { TransactionTypeBadge } from "./transaction-type-badge";

const MONTH_ABBREVIATIONS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** `2025-10-15` → `15 Oct 2025`, as in `transactions-page.png` (D-29). Built by hand, not from a locale, because
 * `en-GB` renders September as `Sept`. */
function formatDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return `${parsed.getUTCDate()} ${MONTH_ABBREVIATIONS[parsed.getUTCMonth()]} ${parsed.getUTCFullYear()}`;
}

/** Sign comes from `type`, currency symbol from the user's `preferredCurrency`; `amount` itself is always positive (D-03, D-04). */
function formatAmount(amount: number, type: Transaction["type"], currencySymbol: string): string {
  const sign = type === "expense" ? "-" : "+";
  return `${sign}${currencySymbol}${amount.toLocaleString()}`;
}

interface TransactionRowProps {
  transaction: Transaction;
  preferredCurrency: UserProfile["preferredCurrency"];
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
}

export function TransactionRow({ transaction, preferredCurrency, onEdit, onDelete }: Readonly<TransactionRowProps>) {
  const currencySymbol = CURRENCY_SYMBOLS[preferredCurrency];

  return (
    <tr className="border-b border-gray-100 last:border-b-0">
      <td className="px-4 py-4 text-[15px] text-brand-ink">{formatDate(transaction.date)}</td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <CategoryIcon category={transaction.category} />
          <span className="text-[15px] text-brand-ink">{CATEGORY_LABELS[transaction.category]}</span>
        </div>
      </td>
      <td className="px-4 py-4 text-[15px] text-brand-ink">{transaction.title}</td>
      <td className="px-4 py-4 text-[15px] text-brand-ink">{transaction.description}</td>
      <td className="px-4 py-4 text-[15px] text-brand-ink">
        {formatAmount(transaction.amount, transaction.type, currencySymbol)}
      </td>
      <td className="px-4 py-4">
        <TransactionTypeBadge type={transaction.type} />
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onEdit(transaction)}
            aria-label={`Edit ${transaction.title}`}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-white hover:bg-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <EditIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(transaction)}
            aria-label={`Delete ${transaction.title}`}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
