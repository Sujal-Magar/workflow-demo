---
id: goals
title: Financial Goals
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
    summary: "Initial specification for FinTrack Financial Goals management, progress tracking cards, goal analytics charts, and Add Goal modal"
---

# Feature Specification: Financial Goals

## 1. Overview

The Goals module provides tracking and planning capabilities for short-term and long-term financial targets (e.g., Emergency Fund, Purchasing Assets, Vacations). Users define targets, track saved amounts against targets with visual progress bars, evaluate goal completion distributions, and track ongoing vs. completed targets.

## 2. Data Model (`Goal` & `GoalProgressSummary`)

### Goal Entity (`Goal`)

| Field          | Type            | Required | Description                                                                                           |
| :------------- | :-------------- | :------- | :---------------------------------------------------------------------------------------------------- |
| `id`           | UUID string     | Yes      | Unique identifier (Primary Key)                                                                       |
| `name`         | string          | Yes      | Goal title (2–100 characters, e.g., "Buy a New Laptop")                                               |
| `targetAmount` | number          | Yes      | Positive decimal target amount in `₹`                                                                 |
| `savedAmount`  | number          | Yes      | Current accumulated savings towards the goal in `₹` (default `0`)                                     |
| `startDate`    | ISO Date string | Yes      | Starting date (`YYYY-MM-DD`, e.g., `"2025-10-01"`)                                                    |
| `endDate`      | ISO Date string | Yes      | Target target completion date (`YYYY-MM-DD`, e.g., `"2026-04-30"`)                                    |
| `category`     | enum            | Yes      | `"electronics"`, `"emergency_fund"`, `"travel"`, `"housing"`, `"vehicle"`, `"investment"`, `"others"` |
| `status`       | enum            | Yes      | Goal state: `"ongoing"` or `"completed"`                                                              |
| `createdAt`    | ISO Timestamp   | Yes      | Goal creation timestamp                                                                               |
| `updatedAt`    | ISO Timestamp   | Yes      | Last updated timestamp                                                                                |

### Computed Metrics (`GoalProgressSummary`)

| Field                 | Type   | Description                                                                             |
| :-------------------- | :----- | :-------------------------------------------------------------------------------------- |
| `percentageCompleted` | number | Calculated progress: $\min(100, (\text{savedAmount} / \text{targetAmount}) \times 100)$ |
| `remainingAmount`     | number | Calculated shortfall: $\max(0, \text{targetAmount} - \text{savedAmount})$               |

## 3. Functional Requirements

### REQ-GOAL-01: Goal Cards Display

- Renders an interactive card grid representing individual financial goals.
- Each goal card must display:
  - Goal Name (e.g., `"Buy a New Laptop"`, `"Emergency Fund"`, `"Vacation Trip"`).
  - Target vs. Saved label (e.g., `₹80,000 Target | ₹50,000 Saved`).
  - Horizontal progress bar filled proportionally to `percentageCompleted` with percentage badge (e.g., `62%`, `40%`, `100%`).
  - Status badge:
    - `"Ongoing"`: Light green/teal badge pill.
    - `"Completed"`: Solid green badge pill indicating $\ge 100\%$ target achievement.

### REQ-GOAL-02: Add Goal Modal

- Triggered by clicking the primary teal `+ Add Goal` button.
- Form fields in vertical stack layout:
  1. **Goal Name**: Text input with placeholder `"Goal Name"`.
  2. **Target Amount (₹)**: Numeric input with placeholder `"Target Amount (₹)"`.
  3. **Start Date**: Date picker with calendar icon and placeholder `"Start Date"`.
  4. **End Date**: Date picker with calendar icon and placeholder `"End Date"`.
  5. **Category**: Select dropdown defaulting to `"All Categories"`.
  6. **Status**: Select dropdown defaulting to `"Status"` (options: `Ongoing`, `Completed`).
- Modal Actions: Outlined `"Cancel"` button and solid teal `"Add"` button.
- On success: Dispatches green toast (`"Goal created successfully!"`) and refreshes list.
- On error: Dispatches red toast (`"Failed to add goal. Please try again."`).

### REQ-GOAL-03: Filtering Controls

- **Status Filter**: Dropdown selector defaulting to `"Status"` (options: `All`, `Ongoing`, `Completed`).
- **Time Period Filter**: Dropdown selector defaulting to `"Time Period"` (options: `All Time`, `This Month`, `This Year`).
- Updating filters refetches and repopulates the goal cards and analytics dynamically without a page refresh.

### REQ-GOAL-04: Goal Progress Overview Charts

- **Goal Progress Chart**: Grouped dual-bar chart showing Saved Amount (teal bar) versus Remaining Amount (light gray bar) across each defined goal with vertical currency scale up to `200,000`.
- **Completed vs Ongoing Goals Chart**: Donut/pie chart illustrating the percentage breakdown of completed versus active ongoing goals (e.g., `83.3% Ongoing`, `16.7% Completed`) with legend indicators.

## 4. Validation Rules

- `name`: Must be non-empty and between 2 and 100 characters.
- `targetAmount`: Must be a numeric value strictly $> 0$.
- `startDate` & `endDate`: Must be valid ISO date strings; `endDate` must be greater than or equal to `startDate`.
- Automatically updates `status` to `"completed"` if `savedAmount` reaches or exceeds `targetAmount`.

## 5. API / Interface Specification

### Goal Endpoints

| API / Operation Name | Method   | Endpoint            | Query / Body Params                                                        | Success Status / Response                              | Description                                             |
| :------------------- | :------- | :------------------ | :------------------------------------------------------------------------- | :----------------------------------------------------- | :------------------------------------------------------ |
| `getGoals`           | `GET`    | `/api/v1/goals`     | Query: `status`, `timePeriod`                                              | `200 OK` (`goals: Goal[]`, `analytics: GoalAnalytics`) | Retrieves goals list and aggregated progress comparison |
| `createGoal`         | `POST`   | `/api/v1/goals`     | Body: `name`, `targetAmount`, `startDate`, `endDate`, `category`, `status` | `201 Created` (`Goal` object)                          | Creates a new financial goal                            |
| `updateGoal`         | `PUT`    | `/api/v1/goals/:id` | Body: Partial update payload                                               | `200 OK` (`Goal` object)                               | Updates an existing goal's targets or saved amounts     |
| `deleteGoal`         | `DELETE` | `/api/v1/goals/:id` | Path: `id`                                                                 | `200 OK` (`success: true`)                             | Deletes a tracked financial goal                        |

## 6. Acceptance Criteria

- User can view financial goals as cards displaying saved vs target amount, percentage badge, and status pill.
- User can open the "Add Goal" modal, complete required inputs, and save a new goal.
- Goals automatically reflect "Completed" badge when saved amount meets or exceeds target amount.
- Form displays validation errors if target amount is non-positive or end date precedes start date.
- Filtering by status (Ongoing/Completed) or time period updates cards and chart analytics without page reload.
- User can update progress or delete an existing goal.
