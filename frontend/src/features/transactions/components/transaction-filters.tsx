"use client";

import { SelectField, type SelectFieldOption } from "@/components/ui/select-field";

import { CATEGORIES, type Category, type Sort, type Timeframe, type TransactionType } from "../api/transactions-api";
import { CATEGORY_LABELS } from "./category-icon";
import { TRANSACTION_TYPE_LABELS } from "./transaction-type-badge";

/** Closed 4-value enum (plan Decision D-05) — no "Today" option. */
const TIMEFRAME_OPTIONS: readonly SelectFieldOption[] = [
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "this_year", label: "This Year" },
  { value: "all_time", label: "All Time" },
];

const CATEGORY_OPTIONS: readonly SelectFieldOption[] = [
  { value: "", label: "All Category" },
  ...CATEGORIES.map((category) => ({ value: category, label: CATEGORY_LABELS[category] })),
];

const TYPE_OPTIONS: readonly SelectFieldOption[] = [
  { value: "", label: "All Types" },
  { value: "income", label: TRANSACTION_TYPE_LABELS.income },
  { value: "expense", label: TRANSACTION_TYPE_LABELS.expense },
];

const SORT_OPTIONS: readonly SelectFieldOption[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
];

export interface TransactionFiltersValue {
  readonly timeframe: Timeframe;
  readonly category: Category | "";
  readonly type: TransactionType | "";
  readonly sort: Sort;
}

interface TransactionFiltersProps {
  value: TransactionFiltersValue;
  onChange: (value: TransactionFiltersValue) => void;
}

/** Four filter dropdowns (plan FE-03). Any change is reported via `onChange`; the page resets `page` to 1. */
export function TransactionFilters({ value, onChange }: Readonly<TransactionFiltersProps>) {
  return (
    <div className="flex flex-wrap gap-3">
      <SelectField
        label="Timeframe"
        options={TIMEFRAME_OPTIONS}
        value={value.timeframe}
        onChange={(event) => onChange({ ...value, timeframe: event.target.value as Timeframe })}
        containerClassName="w-44"
      />
      <SelectField
        label="Category"
        options={CATEGORY_OPTIONS}
        value={value.category}
        onChange={(event) => onChange({ ...value, category: event.target.value as Category | "" })}
        containerClassName="w-52"
      />
      <SelectField
        label="Type"
        options={TYPE_OPTIONS}
        value={value.type}
        onChange={(event) => onChange({ ...value, type: event.target.value as TransactionType | "" })}
        containerClassName="w-44"
      />
      <SelectField
        label="Sort"
        options={SORT_OPTIONS}
        value={value.sort}
        onChange={(event) => onChange({ ...value, sort: event.target.value as Sort })}
        containerClassName="w-44"
      />
    </div>
  );
}
