import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import type { Category } from "../api/transactions-api";

export const CATEGORY_LABELS: Readonly<Record<Category, string>> = {
  food_and_dining: "Food & Dining",
  salary: "Salary",
  transportation: "Transportation",
  shopping: "Shopping",
  investment: "Investment",
  freelance_work: "Freelance Work",
  bills_and_utilities: "Bills & Utilities",
  health_and_fitness: "Health & Fitness",
  savings_account: "Savings Account",
  others: "Others",
};

function Glyph({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Purely presentational glyph per category; exact choice is left to Build Mode's judgment (plan FE-04). */
const CATEGORY_GLYPHS: Readonly<Record<Category, ReactNode>> = {
  food_and_dining: (
    <Glyph>
      <path d="M7 2v8M5 2v4a2 2 0 0 0 2 2 2 2 0 0 0 2-2V2M7 12v10" />
      <path d="M17 2c-1.5 2-2 4-2 7a2 2 0 0 0 2 2v9" />
    </Glyph>
  ),
  salary: (
    <Glyph>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Glyph>
  ),
  transportation: (
    <Glyph>
      <path d="M4 16V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7" />
      <path d="M4 16h16M7 16v2M17 16v2" />
      <circle cx="7.5" cy="16" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="16" r="1.1" fill="currentColor" stroke="none" />
    </Glyph>
  ),
  shopping: (
    <Glyph>
      <path d="M6 7h12l-1 13H7L6 7Z" />
      <path d="M9 7V5a3 3 0 0 1 6 0v2" />
    </Glyph>
  ),
  investment: (
    <Glyph>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 13l2.2-2.2L12.4 13l3.6-3.6" />
    </Glyph>
  ),
  freelance_work: (
    <Glyph>
      <rect x="3" y="5" width="18" height="12" rx="1.5" />
      <path d="M3 15h18M9 19h6" />
    </Glyph>
  ),
  bills_and_utilities: (
    <Glyph>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
    </Glyph>
  ),
  health_and_fitness: (
    <Glyph>
      <path d="M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9Z" />
    </Glyph>
  ),
  savings_account: (
    <Glyph>
      <path d="M4 12a6 6 0 0 1 6-6h4l2-2 1 2h1a2 2 0 0 1 2 2v1l1 1-1 1v1a2 2 0 0 1-2 2h-1v2a2 2 0 0 1-2 2H9v-2a6 6 0 0 1-5-6Z" />
      <circle cx="9" cy="11" r="0.7" fill="currentColor" stroke="none" />
    </Glyph>
  ),
  others: (
    <Glyph>
      <circle cx="6" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </Glyph>
  ),
};

interface CategoryIconProps {
  category: Category;
  className?: string;
}

export function CategoryIcon({ category, className }: Readonly<CategoryIconProps>) {
  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-slate-600",
        className
      )}
    >
      {CATEGORY_GLYPHS[category]}
    </span>
  );
}
