# Behavior Specification: Transactions Management

## 1. Ledger View & Filter Behavior

- Navigating to `/transactions` loads the transaction table with active filters defaulting to "This Month", "All Category", "All Types", and "Newest First".
- Adjusting any filter re-queries transactions and resets pagination back to page 1.

## 2. Add Transaction Workflow

1. User clicks the **+ Add Transaction** button at the top right of the page.
2. The **Add Transaction** modal appears over a darkened backdrop:
   - Date picker defaults to empty or today's date with a calendar icon.
   - Description input displays placeholder `Enter Description`.
   - Category dropdown displays placeholder `All Category`.
   - Type dropdown displays placeholder `All Types`.
   - Amount input displays placeholder `Amount`.
3. User fills in all required fields and clicks **Add**:
   - **Validation check**: If any required field is empty or amount is $\le 0$, inline error indicators highlight the invalid fields.
   - **On submission error**: A light red error toast notification slides in at the top right: _"Failed to add transaction. Please try again."_ Form state is preserved.
   - **On submission success**: The modal closes, a light green success toast slides in (_"Transaction added successfully!"_), and the new record is added to the top of the table.
4. User clicks **Cancel** or outside the modal backdrop: The modal closes immediately and all unsaved input is discarded.

## 3. Edit Transaction Workflow

1. User clicks the yellow pencil icon on any row in the ledger.
2. The **Edit Transaction** modal opens with values pre-populated:
   - Date selector pre-filled (e.g., `17 Oct 2025`).
   - Description pre-filled (e.g., `Dinner at Café Coffee Day`).
   - Category selector set to current category (e.g., `Food & Dining`).
   - Type selector set to current type (e.g., `Expense`).
   - Amount pre-filled (e.g., `-₹450`).
3. User edits desired values and clicks **Save**:
   - On success, the modal closes, the corresponding table row updates, and a success toast is displayed.
4. User clicks **Cancel**: Modal closes and changes are discarded.

## 4. Delete Transaction Workflow

1. User clicks the red trash bin icon on a transaction row.
2. The **Delete Transaction?** confirmation dialog appears:
   - Header: `"Delete Transaction?"`
   - Subtext: _"Are you sure you want to delete this transaction? This action cannot be undone."_
3. If the user clicks **Cancel**: Modal closes with no changes made.
4. If the user clicks **Delete**:
   - The transaction is permanently deleted from the database.
   - The row is removed from the table.
   - Summary statistics and pagination count recalculate automatically.
   - A confirmation toast displays informing the user of successful removal.
