# Behavior Specification: Dashboard Overview

## 1. Initial Page Load

- Accessing `/dashboard` sets the primary top navigation active tab to **Dashboard**.
- A default period filter of **"This Month"** is applied automatically.
- Skeleton loaders render inside the 4 metric cards, both chart containers, and the recent transactions table until aggregate data is fetched.

## 2. KPI Summary Cards

- Displays 4 metric tiles across a grid layout:
  - **Total Balance**: Displays formatted total net balance and delta compared to the start of the current month.
  - **Total Income**: Displays monthly total inflow along with percentage change from previous month.
  - **Total Expense**: Displays monthly total outflow with percentage change from previous month.
  - **Savings Rate**: Displays percentage of income saved along with net performance change.
- Hovering over a card displays a subtle elevation transition.

## 3. Spending Overview & Filtering

- Users can click the period dropdown (**"This Month"**) located at the top right of the Spending Overview container to switch historical ranges.
- Selecting a new range initiates an asynchronous fetch for aggregated chart and card data without triggering a full page reload.

### Income vs Expense Chart

- Renders a monthly timeline line graph comparing Income (green) and Expense (red) trajectories.
- Hovering over data points on the graph surfaces an interactive tooltip indicating exact Rupee values for both income and expense for that specific month.

### Expense Breakdown Pie Chart

- Displays category distribution (Food, Travel, Entertainment, Shopping, Others).
- Hovering over a pie segment expands the slice slightly and highlights the matching item in the category legend.

## 4. Recent Transactions

- Shows the 5 most recent records with columns: **Transaction**, **Category**, **Date**, and **Amount**.
- Income entries display with a leading `+` sign and positive tone.
- Outflow entries display with a leading `-` sign.
- Clicking the **"View All"** link navigates the user to `/transactions`.

## 5. Empty & Error States

- If no transactions exist for the selected period:
  - Metric cards render `₹0` with `0%` change indicator.
  - Line graph shows flat baselines along the 0 horizontal axis.
  - Expense pie chart renders a single gray placeholder circle labeled "No expenses recorded".
  - Recent transactions container displays an empty state: "No recent transactions found."
- Network or aggregation errors render an in-card retry banner allowing the user to refresh dashboard metrics.
