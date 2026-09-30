---
id: transactions
title: Transactions Management
status: active
version: 1.0.0
owner: core-finance-team
last_updated: 2026-09-22
coverage_target: 90
compliance_relevant: false
dependencies:
  - auth
  - profile
changelog:
  - version: 1.0.0
    date: 2026-09-22
    summary: "Initial specification for FinTrack Transactions ledger, pagination, filtering, and CRUD operations"
---

# Feature Specification: Transactions Management

## 1. Overview

The Transactions module provides the core financial ledger for the FinTrack application. Users can view, create, edit, delete, filter, sort, and paginate their historical income and expense records using dedicated modal workflows.

## 2. Data Model (`Transaction`)

| Field         | Type            | Required | Description                                                                                                                                                                             |
| :------------ | :-------------- | :------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | UUID string     | Yes      | Unique identifier (Primary Key)                                                                                                                                                         |
| `date`        | ISO Date string | Yes      | Date of transaction (`YYYY-MM-DD`, e.g., `"2025-10-17"`)                                                                                                                                |
| `description` | string          | Yes      | Transaction details/memo (1–255 characters)                                                                                                                                             |
| `category`    | enum            | Yes      | `"food_and_dining"`, `"salary"`, `"transportation"`, `"shopping"`, `"investment"`, `"freelance_work"`, `"bills_and_utilities"`, `"health_and_fitness"`, `"savings_account"`, `"others"` |
| `type`        | enum            | Yes      | Direction of transaction: `"income"` or `"expense"`                                                                                                                                     |
| `amount`      | number          | Yes      | Positive decimal amount displayed with localized currency symbol (`₹`)                                                                                                                  |
| `createdAt`   | ISO Timestamp   | Yes      | Record creation timestamp                                                                                                                                                               |
| `updatedAt`   | ISO Timestamp   | Yes      | Record last updated timestamp                                                                                                                                                           |

## 3. Functional Requirements

### REQ-TXN-01: Add Transaction Modal

- Triggered by clicking the "+ Add Transaction" button on the ledger toolbar.
- Renders an input form modal with stacked controls:
  1. **Date Picker Dropdown**: Calendar selector with placeholder `Title` / date format.
  2. **Description Field**: Text input with placeholder `"Enter Description"`.
  3. **Category Dropdown**: Select menu defaulting to placeholder `"All Category"`.
  4. **Type Dropdown**: Select menu defaulting to placeholder `"All Types"` (options: `Income`, `Expense`).
  5. **Amount Field**: Numeric input with placeholder `"Amount"`.
- Modal Actions: Outlined `"Cancel"` button and primary teal `"Add"` button.
- On success: Dispatches a green success toast (`"Transaction added successfully!"`), adds the record, and refreshes the ledger view.
- On failure: Dispatches a red error toast (`"Failed to add transaction. Please try again."`) and retains user inputs.

### REQ-TXN-02: Edit Transaction Modal

- Triggered by clicking the yellow Edit (pencil) action button on an existing transaction row.
- Opens the "Edit Transaction" modal with fields pre-filled from the selected record:
  - Date picker populated with transaction date (e.g., `17 Oct 2025`).
  - Description input populated with description text (e.g., `Dinner at Café Coffee Day`).
  - Category selector populated with current category (e.g., `Food & Dining`).
  - Type selector populated with current type (e.g., `Expense`).
  - Amount input populated with formatted value (e.g., `450`).
- Modal Actions: Outlined `"Cancel"` button and primary teal `"Save"` button.
- On successful update, persists changes, updates the table row, and displays a success notification.

### REQ-TXN-03: Delete Confirmation Modal

- Triggered by clicking the red Delete (trash) action button on a transaction row.
- Displays a dedicated confirmation card titled **"Delete Transaction?"**:
  - Explanatory copy: _"Are you sure you want to delete this transaction? This action cannot be undone."_
  - Action buttons: Outlined `"Cancel"` button and solid red `"Delete"` button.
- Confirming permanently removes the record and recalculates totals and pagination.

### REQ-TXN-04: View & Filter Ledger Table

- Renders transaction rows with Date, Category, Description, Amount, Type badge, and Actions.
- Supports filtering by Timeframe, Category, and Type, alongside Newest/Oldest sorting.
- Includes pagination navigation controls ("Prev", numbered pages, "Next").

## 4. UI Feedback & Notification Patterns

- **Toast / Success**: Light green banner with green checkmark icon (`#22C55E`) and label `"Transaction added successfully!"`.
- **Toast / Error**: Light red banner with red alert circle icon (`#EF4444`) and label `"Failed to add transaction. Please try again."`.
- Toasts auto-dismiss after 4000ms or on user interaction.

## 5. API / Interface Specification

### Transaction Endpoints

| API / Operation Name | Method   | Endpoint                   | Query / Body Params                                             | Success Status / Response                         | Description                                        |
| :------------------- | :------- | :------------------------- | :-------------------------------------------------------------- | :------------------------------------------------ | :------------------------------------------------- |
| `getTransactions`    | `GET`    | `/api/v1/transactions`     | Query: `page`, `limit`, `category`, `type`, `timeframe`, `sort` | `200 OK` (`data: Transaction[]`, `total: number`) | Returns paginated and filtered transactions ledger |
| `createTransaction`  | `POST`   | `/api/v1/transactions`     | Body: `date`, `description`, `category`, `type`, `amount`       | `201 Created` (`Transaction` object)              | Creates a new income or expense transaction        |
| `updateTransaction`  | `PUT`    | `/api/v1/transactions/:id` | Body: `date`, `description`, `category`, `type`, `amount`       | `200 OK` (`Transaction` object)                   | Updates an existing transaction by ID              |
| `deleteTransaction`  | `DELETE` | `/api/v1/transactions/:id` | Path: `id`                                                      | `200 OK` (`success: true`, `id: string`)          | Permanently deletes a transaction by ID            |

## 6. Acceptance Criteria

- User can view a paginated list of transactions showing date, description, category, amount, and type.
- User can open the "Add Transaction" modal, fill in required fields, submit, and observe the new transaction in the ledger.
- Submitting empty or invalid values in the "Add Transaction" modal displays inline validation errors without submitting.
- User can click the edit icon on an existing row to prefill and update transaction details.
- User can click the delete icon, view the confirmation modal, and confirm permanent deletion.
- Filtering by category, type (income/expense), or date range dynamically updates the displayed transactions.
- Successful actions trigger green success toasts, while failed operations trigger red error toasts.
