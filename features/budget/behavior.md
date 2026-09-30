# Behavior Specification: Budget Planner

## 1. Initial Page Load

- Navigating to `/budget` activates the **Budget** tab in the top navigation.
- Period defaults to current month (e.g., "October 2025") and category filter to "All Categories".
- Fetches budget definitions and computes spent values against the transaction store.

## 2. KPI Summary Cards

- **Total Budget**: Sum of all limits defined for the active month.
- **Total Spent**: Actual aggregate expenditure from transactions recorded for the month.
- **Remaining**: Remaining disposable budget before reaching spending threshold, paired with a green overall progress bar.

## 3. Budget List & Status Thresholds

- Renders budgeted categories with Limit, Spent, Remaining, and Progress visualization:
  - If `spent <= limit`: Remaining displays a positive balance (`₹1,800`) and the progress bar renders in teal/green.
  - If `spent > limit`: Remaining displays a negative balance (`-₹1,400`) and the progress bar turns solid red (e.g., `118% used`).
- Pagination controls allow navigating across pages when numerous categories are budgeted.

## 4. Add Budget Flow

1. User clicks **+ Add New Budget**.
2. Add New Budget modal opens:
   - User selects Category from dropdown.
   - Enters numeric Budget limit.
   - Selects Month/Year.
   - Optionally inputs Notes.
3. User clicks **Add**:
   - If successful: Modal closes, green success toast (_"Budget created successfully!"_) displays, and the list updates.
   - If invalid/failed: Red error toast (_"Failed to add budget. Please try again."_) displays.
4. User clicks **Cancel**: Modal closes without saving.

## 5. Edit Budget Flow

1. User clicks the yellow Edit pencil on any budget row.
2. Edit Budget modal displays populated with current category, limit value, month, and notes.
3. User modifies parameters and clicks **Add** / **Save**.
4. Values update in-place and summary recalculates.

## 6. Delete Budget Flow

1. User clicks the red Delete trash button on a budget row.
2. Confirmation modal appears: _"Delete Budget? / Are you sure you want to delete this budget? This action cannot be undone."_
3. Clicking **Cancel** closes dialog with no action.
4. Clicking **Delete** removes the budget entry, closes dialog, and recalculates total budget metrics.

## 7. Budget Insights Section

- **Budget vs Spending Over Time**: Displays a horizontal line representing the budget threshold against a dynamic curved line representing historical spend.
- **Category-wise Budget Allocation**: Interactive pie chart displaying category allocation shares. Hovering over slices highlights category details in the legend.
