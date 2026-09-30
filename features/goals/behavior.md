# Behavior Specification: Financial Goals

## 1. Initial Page Load

- Navigating to `/goals` sets the **Goals** top navigation tab to active.
- Filter defaults:
  - Status: `"Status"` (All statuses)
  - Time Period: `"Time Period"` (All timeframes)
- Fetches all financial goals and calculates progress distributions against savings records.

## 2. Goal Cards Display

- Displays individual goal summary cards in a responsive grid:
  - Shows Goal Title.
  - Shows Target vs. Saved values localized in Rupee format (`₹80,000 Target | ₹50,000 Saved`).
  - Displays a percentage-filled teal progress bar with the numeric percentage on the right end.
  - Displays a pill badge indicating either `Ongoing` (light green) or `Completed` (solid green).
- Clicking a card opens detailed goal transaction allocations.

## 3. Add Goal Workflow

1. User clicks the **+ Add Goal** button.
2. The **Add New Goal** modal opens:
   - User inputs Goal Name in text field.
   - Enters Target Amount (₹).
   - Selects Start Date from datepicker.
   - Selects End Date from datepicker.
   - Selects Category from dropdown.
   - Selects initial Status (`Ongoing` / `Completed`).
3. User clicks **Add**:
   - Validates that target amount $> 0$ and `endDate >= startDate`.
   - On success: Modal dismisses, success toast slides in (_"Budget created successfully!"_ / _"Goal created successfully!"_), and the new goal card appears.
   - On error: Error toast slides in (_"Failed to add budget. Please try again."_) while preserving inputs.
4. User clicks **Cancel** or backdrop: Closes modal and cancels pending inputs.

## 4. Goal Progress Overview Charts

- **Goal Progress**:
  - Compares Saved Amount against Remaining Amount for each goal side-by-side.
  - Teal bars represent accumulated savings; light gray bars show the remaining balance to meet the target.
- **Completed vs Ongoing Goals**:
  - Renders a pie breakdown showing the relative proportion of goals completed vs. currently ongoing.
  - Hovering over a segment surfaces the exact count and percentage.

## 5. Filter Interaction

- Selecting a filter in either the **Status** or **Time Period** dropdown refreshes the goal cards and analytics graphs dynamically.
- If no goals match the filter criteria:
  - Displays empty state: "No goals found matching the selected criteria."
  - Provides a shortcut button to "Clear Filters" or "+ Add Goal".
