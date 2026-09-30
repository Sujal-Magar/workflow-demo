---
id: budget
title: Budget Planner
status: active
version: 1.0.0
owner: planning-team
last_updated: 2026-09-22
coverage_target: 85
compliance_relevant: false
dependencies:
  - auth
  - profile
  - transactions
changelog:
  - version: 1.0.0
    date: 2026-09-22
    summary: "Initial specification for FinTrack Budget Planner, category limits, spending progress bars, budget insights, and CRUD modals"
---

# Feature Specification: Budget Planner

## 1. Overview

The Budget module allows users to plan and monitor their monthly limits against actual category expenditures. It aggregates spending from transactions, calculates remaining allowances, alerts users when limits are exceeded via visual progress thresholds, and visualizes monthly budget allocations and historical spending trends.

## 2. Data Model (`Budget` & `BudgetProgress`)

### Budget Entity (`Budget`)

| Field       | Type          | Required | Description                                                                                                                                                |
| :---------- | :------------ | :------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`        | UUID string   | Yes      | Unique identifier (Primary Key)                                                                                                                            |
| `category`  | enum          | Yes      | `"food_and_dining"`, `"transportation"`, `"shopping"`, `"bills_and_utilities"`, `"entertainment"`, `"health_and_fitness"`, `"savings_account"`, `"others"` |
| `limit`     | number        | Yes      | Positive numeric monthly allowance in `₹`                                                                                                                  |
| `monthYear` | string        | Yes      | Period format `YYYY-MM` (e.g., `"2025-10"`)                                                                                                                |
| `notes`     | string        | No       | Optional description or budget memo                                                                                                                        |
| `createdAt` | ISO Timestamp | Yes      | Creation timestamp                                                                                                                                         |
| `updatedAt` | ISO Timestamp | Yes      | Last updated timestamp                                                                                                                                     |

### Computed Budget Progress (`BudgetProgressItem`)

| Field            | Type        | Description                                                       |
| :--------------- | :---------- | :---------------------------------------------------------------- |
| `budgetId`       | UUID string | Reference to `Budget.id`                                          |
| `category`       | string      | Budget category identifier                                        |
| `limit`          | number      | Defined monthly spending limit                                    |
| `spent`          | number      | Sum of actual expense transactions for this category in the month |
| `remaining`      | number      | Calculated difference: $\text{limit} - \text{spent}$              |
| `percentageUsed` | number      | Calculated ratio: $(\text{spent} / \text{limit}) \times 100$      |
| `isExceeded`     | boolean     | `true` if $\text{spent} > \text{limit}$, otherwise `false`        |

## 3. Functional Requirements

### REQ-BUD-01: Summary KPI Metrics

- Calculate and display top-level metrics for the selected month:
  - **Total Budget**: Sum of all defined budget category limits (e.g., `₹ 60,000`).
  - **Total Spent**: Sum of all expenses incurred in the budgeted month (e.g., `₹ 43,200`) along with change indicator.
  - **Remaining**: Difference between Total Budget and Total Spent (e.g., `₹ 16,800`) with an overall utilization progress indicator (e.g., `72% used`).

### REQ-BUD-02: Budget List Table & Progress Indicators

- Displays tabular breakdown with columns: Category (with icon), Limit, Spent, Remaining, Progress, and Actions.
- Progress column renders a progress bar with percentage used:
  - Under budget ($\le 100\%$): Green progress indicator.
  - Exceeded budget ($> 100\%$): Solid red progress indicator with negative remaining amount displayed (e.g., `-₹1,400`, `118% used`).
- Row actions include Edit (yellow pencil) and Delete (red trash).
- Includes pagination controls ("Prev", numbered pages, "Next").

### REQ-BUD-03: Filter Controls

- Month/Year selector dropdown (e.g., `"October 2025"`).
- Category filter dropdown defaulting to `"All Categories"`.
- Modifying filters dynamically updates KPI summaries, list progress, and budget insights.

### REQ-BUD-04: Add Budget Modal

- Triggered by clicking "+ Add New Budget".
- Form inputs:
  1. **Category Dropdown**: Placeholder `"All Categories"`.
  2. **Budget limit (₹)**: Numeric input for monetary limit.
  3. **Month / Year Picker**: Dropdown defaulting to active period (e.g., `"October 2025"`).
  4. **Notes**: Text input with placeholder `"Notes"`.
- Actions: `"Cancel"` and `"Add"` buttons.
- Success triggers toast: `"Budget created successfully!"`.
- Failure triggers toast: `"Failed to add budget. Please try again."`.

### REQ-BUD-05: Edit Budget Modal

- Triggered by clicking Edit icon on a budget row.
- Pre-populates category, limit value (e.g., `₹10,000`), month/year, and notes.
- Actions: `"Cancel"` and `"Save"` buttons.

### REQ-BUD-06: Delete Budget Modal

- Triggered by clicking Delete icon on a budget row.
- Displays confirmation dialog: _"Delete Budget? / Are you sure you want to delete this budget? This action cannot be undone."_
- Actions: `"Cancel"` and solid red `"Delete"`.

### REQ-BUD-07: Budget Insights

- **Budget vs Spending Over Time**: Multi-line monthly trend chart comparing static Budget limit baseline against actual Spending line trajectory over historical months (Jan - Jun).
- **Category-wise Budget Allocation**: Pie/donut chart illustrating category distribution percentages (Food & Dining, Transportation, Shopping, Bills & Utilities, Entertainment, Savings & Investments).

## 4. Validation Rules

- `limit`: Must be a positive number $> 0$.
- Unique category per month: A user cannot create duplicate budget entries for the same category within the same `monthYear` period.
- `monthYear`: Must match valid format (`YYYY-MM`).

## 5. API / Interface Specification

### Budget Endpoints

| API / Operation Name | Method   | Endpoint              | Query / Body Params                             | Success Status / Response                                                                                                     | Description                                              |
| :------------------- | :------- | :-------------------- | :---------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------- |
| `getBudgets`         | `GET`    | `/api/v1/budgets`     | Query: `monthYear`, `category`                  | `200 OK` (`totalBudget`, `totalSpent`, `remaining`, `overallPercentageUsed`, `items`, `spendingTrend`, `allocationBreakdown`) | Retrieves monthly budget summary, progress, and insights |
| `createBudget`       | `POST`   | `/api/v1/budgets`     | Body: `category`, `limit`, `monthYear`, `notes` | `201 Created` (`Budget` object)                                                                                               | Creates a new monthly budget limit for a category        |
| `updateBudget`       | `PUT`    | `/api/v1/budgets/:id` | Body: `category`, `limit`, `monthYear`, `notes` | `200 OK` (`Budget` object)                                                                                                    | Updates an existing budget record by ID                  |
| `deleteBudget`       | `DELETE` | `/api/v1/budgets/:id` | Path: `id`                                      | `200 OK` (`success: true`)                                                                                                    | Deletes a budget limit entry by ID                       |

## 6. Acceptance Criteria

- User can view top-level monthly budget KPIs (Total Budget, Total Spent, Remaining, Percentage Used).
- Budget list displays visual progress bars that turn red when expenditures exceed 100% of the limit.
- User can create a new budget category limit for the selected month/year.
- Attempting to add a second budget for an existing category in the same month triggers a validation error.
- User can edit an existing budget's limit or notes.
- User can delete a budget limit with confirmation modal dialog.
- Modifying month/year filter updates budget items, KPI cards, and charts in real time.
