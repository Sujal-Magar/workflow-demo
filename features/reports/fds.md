---
id: reports
title: Reports and Analytics
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
changelog:
  - version: 1.0.0
    date: 2026-09-22
    summary: "Initial specification for FinTrack Reports & Analytics, data visualization charts, filtering, and export capabilities"
---

# Feature Specification: Reports and Analytics

## 1. Overview

The Reports & Analytics module provides in-depth visualization and statistical evaluation of historical financial trends. Users can analyze multi-month cash flow trajectories (Income vs. Expense), compare absolute category-level expenditures using bar visualizations, inspect the top expense drivers via proportional pie distributions, filter by custom timeframes/categories, and export aggregated reports.

## 2. Data Model (`ReportAnalytics`)

### Income vs Expense Trajectory (`CashFlowTrend`)

| Field     | Type   | Description                                                              |
| :-------- | :----- | :----------------------------------------------------------------------- |
| `month`   | string | Month label (e.g., `"Jan"`, `"Feb"`, `"Mar"`, `"Apr"`, `"May"`, `"Jun"`) |
| `income`  | number | Aggregated monthly inflow in `₹`                                         |
| `expense` | number | Aggregated monthly outflow in `₹`                                        |

### Spending by Category Metric (`CategoryExpenseMetric`)

| Field         | Type   | Description                                                                                                                           |
| :------------ | :----- | :------------------------------------------------------------------------------------------------------------------------------------ |
| `category`    | enum   | `"food_and_dining"`, `"transportation"`, `"entertainment"`, `"shopping"`, `"bills_and_utilities"`, `"health_and_fitness"`, `"others"` |
| `amountSpent` | number | Total expenditure in `₹` for the period                                                                                               |
| `barColor`    | string | Hex code representing category bar visualization                                                                                      |

### Top Expense Item (`TopExpenseDistribution`)

| Field        | Type   | Description                                                                                               |
| :----------- | :----- | :-------------------------------------------------------------------------------------------------------- |
| `category`   | string | Payee or category driver (e.g., `"Rent"`, `"Groceries"`, `"Utilities"`, `"Entertainment"`, `"Transport"`) |
| `percentage` | number | Relative share of top 5 total expenditures (rounded to 1 decimal place)                                   |
| `amount`     | number | Total monetary amount spent in `₹`                                                                        |
| `colorHex`   | string | Visualization slice color hex code                                                                        |

### Report Query Filter (`ReportFilter`)

| Field        | Type   | Description                                                                                       |
| :----------- | :----- | :------------------------------------------------------------------------------------------------ |
| `timePeriod` | enum   | `"this_month"`, `"last_month"`, `"last_3_months"`, `"last_6_months"`, `"this_year"`, `"all_time"` |
| `category`   | string | Category filter (default `"all"`)                                                                 |

## 3. Functional Requirements

### REQ-REP-01: Header Toolbar & Filter Controls

- **Time Period Filter**: Dropdown menu with placeholder `"Time Period"` supporting timeframe selections.
- **Category Filter**: Dropdown menu defaulting to `"All Categories"`.
- **Sub-Header Period Selector**: Dropdown placed in the Financial Overview header bar defaulting to `"This Month"`.
- Any filter update dynamically recalculates chart datasets without page refresh.

### REQ-REP-02: Export Financial Report

- Provide a primary teal action button labeled `"Export"` in the top header.
- Supports downloading aggregated financial analytics data (CSV or PDF summary report) based on active filter selections.

### REQ-REP-03: Income vs Expense Trend Chart

- Line chart plotting comparative trajectories for:
  - **Income**: Green line curve (`#10B981`).
  - **Expense**: Red line curve (`#EF4444`).
- Displays monthly intervals along the horizontal axis (`Jan` through `Jun`) and currency values along the vertical axis (`0` to `20,000`).
- Sub-labeled with `"Monthly trend"`.

### REQ-REP-04: Spending by Category Bar Chart

- Column/Bar chart showing expenditure per category with distinct colored bars:
  - Yellow: Food & Dining
  - Blue: Transportation
  - Red: Entertainment
  - Green: Shopping
  - Purple: Bills & Utilities
- Vertical axis renders scaled amounts up to `40,000` with legend indicator (`Amount Spent (₹)`).

### REQ-REP-05: Top 5 Expenses Breakdown Pie Chart

- Visualizes the top 5 expense drivers for the selected period.
- Renders segmented pie shares: Rent (`31.3%`), Groceries (`25%`), Utilities (`18.8%`), Entertainment (`15%`), and Transport (`10%`).
- Accompanied by a color-coded legend showing category names matching pie slices.

## 4. Validation & Aggregation Rules

- Top 5 Expenses chart strictly includes the 5 categories with the highest total debit amounts; remaining minor categories are excluded or aggregated into an "Others" slice if $>5$ categories exist.
- Pie slice percentages must round to 1 decimal place and sum to `100.0%`.
- Bar chart heights dynamically adjust based on maximum spent value within the queried period.

## 5. API / Interface Specification

### Reports Endpoints

| API / Operation Name    | Method | Endpoint                    | Query Params                                        | Success Status / Response                                         | Description                                            |
| :---------------------- | :----- | :-------------------------- | :-------------------------------------------------- | :---------------------------------------------------------------- | :----------------------------------------------------- |
| `getReportsAnalytics`   | `GET`  | `/api/v1/reports/analytics` | `timePeriod`, `category`                            | `200 OK` (`incomeVsExpense`, `spendingByCategory`, `topExpenses`) | Retrieves trend lines, category bars, and top expenses |
| `exportFinancialReport` | `GET`  | `/api/v1/reports/export`    | `timePeriod`, `category`, `format` (`csv` \| `pdf`) | `200 OK` (binary blob with attachment header)                     | Exports aggregated report data in chosen format        |

## 6. Acceptance Criteria

- User can view cash flow line chart comparing monthly income trajectory against expense trajectory.
- User can view category-wise column charts showing absolute expenditures.
- User can view top 5 expense breakdown donut/pie chart with percentage shares summing to 100%.
- Switching timeframe filter dynamically recalculates all reports charts without full page reload.
- User can trigger export to download report data as CSV or PDF.
