import type { UserProfile } from "@workflow-demo/contracts";

/**
 * Relocated from `profile`'s `read-only-preferences-list.tsx`, which now imports it from here instead of
 * defining its own copy (plan Decision D-04) — `transactions` needs the same mapping to prefix the ledger's
 * Amount column with the signed-in user's currency symbol.
 */
export const CURRENCY_SYMBOLS: Readonly<Record<UserProfile["preferredCurrency"], string>> = {
  NPR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};
