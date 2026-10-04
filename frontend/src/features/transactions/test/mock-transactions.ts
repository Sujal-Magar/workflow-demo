import type { Transaction } from "../api/transactions-api";

/**
 * Deleted at Integration (plan INT-02) once `api/transactions-api.ts` talks to the real backend.
 * Dates are generated relative to "now" (not hardcoded) so the default "This Month"/"This Week" filters
 * always have believable sample data regardless of when the dev server is started.
 */
const SEED: ReadonlyArray<{
  readonly daysAgo: number;
  readonly description: string;
  readonly category: Transaction["category"];
  readonly type: Transaction["type"];
  readonly amount: number;
}> = [
  { daysAgo: 0, description: "Dinner at Café Coffee Day", category: "food_and_dining", type: "expense", amount: 450 },
  { daysAgo: 1, description: "Monthly salary", category: "salary", type: "income", amount: 55000 },
  { daysAgo: 2, description: "Cab ride to office", category: "transportation", type: "expense", amount: 220 },
  { daysAgo: 3, description: "New headphones", category: "shopping", type: "expense", amount: 2500 },
  { daysAgo: 4, description: "Mutual fund SIP", category: "investment", type: "expense", amount: 5000 },
  { daysAgo: 5, description: "Logo design project", category: "freelance_work", type: "income", amount: 8000 },
  { daysAgo: 6, description: "Electricity bill", category: "bills_and_utilities", type: "expense", amount: 1800 },
  { daysAgo: 7, description: "Gym membership", category: "health_and_fitness", type: "expense", amount: 1200 },
  { daysAgo: 9, description: "Fixed deposit interest", category: "savings_account", type: "income", amount: 650 },
  { daysAgo: 10, description: "Grocery shopping", category: "food_and_dining", type: "expense", amount: 1340 },
  { daysAgo: 12, description: "Movie night", category: "shopping", type: "expense", amount: 600 },
  { daysAgo: 14, description: "Freelance website build", category: "freelance_work", type: "income", amount: 15000 },
  { daysAgo: 16, description: "Internet bill", category: "bills_and_utilities", type: "expense", amount: 999 },
  { daysAgo: 18, description: "Doctor visit", category: "health_and_fitness", type: "expense", amount: 800 },
  { daysAgo: 20, description: "Bus pass renewal", category: "transportation", type: "expense", amount: 350 },
  { daysAgo: 22, description: "Stock dividend", category: "investment", type: "income", amount: 1200 },
  { daysAgo: 25, description: "Birthday gift", category: "shopping", type: "expense", amount: 1500 },
  { daysAgo: 28, description: "Savings transfer", category: "savings_account", type: "expense", amount: 3000 },
  { daysAgo: 45, description: "Laptop repair", category: "others", type: "expense", amount: 2200 },
  { daysAgo: 60, description: "Consulting fee", category: "freelance_work", type: "income", amount: 12000 },
  { daysAgo: 95, description: "Annual gym renewal", category: "health_and_fitness", type: "expense", amount: 6000 },
  { daysAgo: 130, description: "Insurance premium", category: "bills_and_utilities", type: "expense", amount: 4500 },
  { daysAgo: 200, description: "Festival bonus", category: "salary", type: "income", amount: 10000 },
  { daysAgo: 400, description: "Old freelance payment", category: "freelance_work", type: "income", amount: 7000 },
];

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateDaysAgo(days: number): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

export const MOCK_TRANSACTIONS: readonly Transaction[] = SEED.map((seed, index) => {
  const date = dateDaysAgo(seed.daysAgo);
  const timestamp = new Date(date);
  // Distinct millisecond offsets give deterministic `createdAt` tie-break ordering (contract.md §2.3, D-07).
  timestamp.setUTCHours(9, 0, 0, index);
  const isoTimestamp = timestamp.toISOString();
  return {
    id: `seed-${String(index + 1).padStart(2, "0")}`,
    date: toDateString(date),
    description: seed.description,
    category: seed.category,
    type: seed.type,
    amount: seed.amount,
    createdAt: isoTimestamp,
    updatedAt: isoTimestamp,
  };
});
