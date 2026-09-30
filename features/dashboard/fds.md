---
id: dashboard
title: Dashboard Overview
status: active
version: 1.0.0
owner: analytics-team
last_updated: 2026-09-22
coverage_target: 85
compliance_relevant: false
dependencies:
  - auth
  - profile
  - transactions
  - budget
  - goals
  - reports
changelog:
  - version: 1.0.0
    date: 2026-09-22
    summary: "Initial specification for FinTrack Dashboard overview, KPI summary metrics, financial charts, and recent activity"
---

# Feature Specification: Dashboard Overview

## 1. Overview

The Dashboard provides users with an aggregated, high-level summary of their financial health, including key balance metrics, monthly cash-flow comparisons (Income vs. Expense), category-level expense distributions, and a ledger of recent transactions.

## 2. Data Model (`DashboardSummary`)

### Metric Summary (`KPISummary`)

| Field               | Type   | Description                                                   |
| :------------------ | :----- | :------------------------------------------------------------ |
| `totalBalance`      | number | Current cumulative net balance in `₹`                         |
| `balanceDelta`      | number | Net change in balance for the selected period (e.g., `+2150`) |
| `totalIncome`       | number | Total earnings for the period                                 |
| `incomeChangeRate`  | number | Percentage change vs. previous period (e.g., `+12%`)          |
| `totalExpense`      | number | Total expenditures for the period                             |
| `expenseChangeRate` | number | Percentage change vs. previous period (e.g., `-8%`)           |
| `savingsRate`       | number | Percentage computed as: `(Income - Expense) / Income * 100`   |
| `savingsRateDelta`  | number | Percentage point shift vs. previous period (e.g., `+3%`)      |

### Trend Point (`CashFlowTrendPoint`)

| Field     | Type   | Description                                                              |
| :-------- | :----- | :----------------------------------------------------------------------- |
| `period`  | string | Month label (e.g., `"Jan"`, `"Feb"`, `"Mar"`, `"Apr"`, `"May"`, `"Jun"`) |
| `income`  | number | Income amount for period                                                 |
| `expense` | number | Expense amount for period                                                |

### Category Expense Slice (`CategoryExpenseBreakdown`)

| Field        | Type   | Description                                                                          |
| :----------- | :----- | :----------------------------------------------------------------------------------- |
| `category`   | enum   | `"food_and_dining"`, `"transportation"`, `"entertainment"`, `"shopping"`, `"others"` |
| `amount`     | number | Monetary expenditure in category                                                     |
| `percentage` | number | Relative share of total period expenses (e.g., `26.1`)                               |
| `colorHex`   | string | Visualization slice color hex code                                                   |

### Recent Transaction Item (`DashboardTransactionItem`)

| Field      | Type        | Description                                                |
| :--------- | :---------- | :--------------------------------------------------------- |
| `id`       | UUID string | Transaction identifier                                     |
| `title`    | string      | Payee or transaction memo (e.g., `"Netflix Subscription"`) |
| `category` | string      | Category identifier                                        |
| `date`     | string      | Formatted display date or ISO date string                  |
| `type`     | enum        | Transaction direction: `"income"` or `"expense"`           |
| `amount`   | number      | Monetary amount in `₹`                                     |

## 3. Functional Requirements

### REQ-DASH-01: Metric Cards Display

- Compute and render four core financial metrics: Total Balance, Total Income, Total Expense, and Savings Rate.
- Each card must render a comparison indicator highlighting absolute or percentage shifts relative to the prior period along with directional trend indicators.
- Currency symbol must conform to localized currency representation (`₹`).

### REQ-DASH-02: Income vs. Expense Trend Line Chart

- Display a multi-line comparison of Income versus Expense across historical intervals (default 6-month trailing view).
- Income plotted with green indicator `#10B981`; Expense plotted with red indicator `#EF4444`.
- Axis values scale dynamically to the peak monetary amount.

### REQ-DASH-03: Expense Category Breakdown Pie Chart

- Display a categorized donut/pie chart reflecting relative expenditures across top categories.
- Slices must dynamically calculate relative percentage shares totaling 100%.
- Color-coded legend must accompany the chart.

### REQ-DASH-04: Period Filter Selection

- Provide a time-range dropdown selector (e.g., `"This Month"`, `"Last Month"`, `"This Year"`) in the Spending Overview header.
- Changing the filter dynamically updates metric aggregations, trend lines, and category distribution.

### REQ-DASH-05: Recent Transactions Table

- Display the 5 most recent ledger activities ordered descending by transaction date.
- Format expense transactions with a minus prefix and black text (`- ₹499`) and income transactions with a plus prefix and green text (`+ ₹25,000`).
- Include a "View All" link directing the user to the complete Transactions module (`/transactions`).

## 4. Validation & Aggregation Rules

- `savingsRate` is clamped between `0%` and `100%` where `income > 0`; defaults to `0%` when income is zero or negative.
- Sum of category percentages must round cleanly to `100.0%`.
- Net balance calculation formula:
  $$\text{Total Balance} = \sum \text{Income} - \sum \text{Expenses}$$
- Recent transactions list is restricted to a maximum limit of 5 records on the overview layout.

## 5. API / Interface Specification

### Dashboard Endpoints

| API / Operation Name   | Method | Endpoint                     | Query Params                                                             | Success Status / Response                                                     | Description                                         |
| :--------------------- | :----- | :--------------------------- | :----------------------------------------------------------------------- | :---------------------------------------------------------------------------- | :-------------------------------------------------- |
| `getDashboardOverview` | `GET`  | `/api/v1/dashboard/overview` | `period` (`this_month` \| `last_month` \| `last_90_days` \| `this_year`) | `200 OK` (`kpis`, `cashFlowTrend`, `categoryBreakdown`, `recentTransactions`) | Retrieves consolidated dashboard metrics and charts |

## 6. Acceptance Criteria

- Dashboard displays 4 KPI cards (Total Balance, Total Income, Total Expense, Savings Rate) with delta indicators.
- Income vs Expense multi-line chart renders comparison curves with tooltip details.
- Expense category breakdown donut chart renders relative percentage shares.
- Recent transactions widget lists the 5 latest records with amounts formatted by type.
- Clicking "View All" navigates user to `/transactions`.
- Modifying the period dropdown refetches and repopulates dashboard metrics.
