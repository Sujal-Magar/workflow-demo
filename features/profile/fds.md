---
id: profile
title: User Profile and Preferences
status: active
version: 1.0.0
owner: user-platform-team
last_updated: 2026-09-22
coverage_target: 85
compliance_relevant: true
dependencies:
  - auth
changelog:
  - version: 1.0.0
    date: 2026-09-22
    summary: "Initial specification for FinTrack user profile details, application settings, notification preferences, data export, and account data wipe"
---

# Feature Specification: User Profile and Preferences

## 1. Overview

The Profile module manages the user's account identity, regional preferences, application-wide financial cycles, notification triggers, and data controls. Because it defines core application settings like `preferredCurrency`, `monthlyStartDate`, and account authentication, it serves as an essential configuration provider across all modules.

## 2. Data Model (`UserProfile`)

| Field                                         | Type          | Required | Description                                                                    |
| :-------------------------------------------- | :------------ | :------- | :----------------------------------------------------------------------------- |
| `id`                                          | UUID string   | Yes      | Unique identifier (Primary Key)                                                |
| `name`                                        | string        | Yes      | Display name (2-100 characters, e.g., "Piyush Kumar")                          |
| `email`                                       | string        | Yes      | Unique, valid email address                                                    |
| `avatarUrl`                                   | string        | No       | URL or local path to profile picture asset                                     |
| `preferredCurrency`                           | enum          | Yes      | ISO currency code (`"NPR"`, `"USD"`, `"EUR"`, `"GBP"`; default `"NPR"`)        |
| `language`                                    | enum          | Yes      | Language locale code (`"en_US"`, `"en_GB"`, `"es"`, `"fr"`; default `"en_US"`) |
| `monthlyStartDate`                            | number        | Yes      | Day of month for budget/accounting cycle start (1–28; default `1`)             |
| `notificationPreferences`                     | object        | Yes      | Key-value settings for notification dispatch                                   |
| `notificationPreferences.budgetLimitAlerts`   | boolean       | Yes      | Whether to dispatch budget threshold alerts (default `true`)                   |
| `notificationPreferences.goalReminders`       | boolean       | Yes      | Whether to dispatch periodic savings goal reminders (default `true`)           |
| `notificationPreferences.weeklySummaryEmails` | boolean       | Yes      | Whether to send weekly summary digest emails (default `true`)                  |
| `createdAt`                                   | ISO Timestamp | Yes      | Profile record creation timestamp                                              |
| `updatedAt`                                   | ISO Timestamp | Yes      | Last update timestamp                                                          |

## 3. Functional Requirements

### REQ-PROF-01: Profile Identity Card

- Displays user avatar circle alongside display Name and Email address.
- Action Buttons:
  - **Edit Profile**: Primary teal button launching personal info update flow.
  - **Change Password**: Secondary light gray/blue button launching password update workflow.

### REQ-PROF-02: Preferences and Settings Card

- Displays system configuration values in label-value layout:
  - **Preferred Currency**: Current currency formatting representation (e.g., `NPR (₹)`).
  - **Language**: Display language code and label (e.g., `English (EN)`).
  - **Monthly Start Date**: Beginning of monthly accounting and budgeting period (e.g., `1st of every month`).
- **Notification Preferences**: Checkbox controls allowing users to toggle:
  - `Budget Limit Alerts`
  - `Goal Reminders`
  - `Weekly Summary Emails`

### REQ-PROF-03: Export Data Action

- Primary teal action button labeled **"Export Data"**.
- Packages all user data (transactions, budgets, goals, profile configuration) into a downloadable bundle (JSON or CSV archive).

### REQ-PROF-04: Clear All Data (Destructive Action)

- Red action button labeled **"Clear All Data"**.
- Triggers a high-severity confirmation prompt requiring explicit user confirmation before wiping transaction history, budget limits, and tracked goals.
- Preserves the base user profile account while resetting ledger datasets to zero.

## 4. Validation Rules

- `name`: Must be between 2 and 100 characters.
- `email`: Must be a valid email format.
- `monthlyStartDate`: Integer between 1 and 28 (to ensure compatibility across all calendar months).
- `Clear All Data`: Requires explicit confirmation string input (e.g., typing "DELETE" or confirming via modal dialog) before triggering data deletion.

## 5. API / Interface Specification

### Profile Endpoints

| API / Operation Name | Method  | Endpoint                     | Request Body                                                                                        | Success Status / Response                     | Description                                                  |
| :------------------- | :------ | :--------------------------- | :-------------------------------------------------------------------------------------------------- | :-------------------------------------------- | :----------------------------------------------------------- |
| `getUserProfile`     | `GET`   | `/api/v1/profile`            | None                                                                                                | `200 OK` (`UserProfile` object)               | Retrieves current authenticated user profile and preferences |
| `updateUserProfile`  | `PATCH` | `/api/v1/profile`            | `name`, `avatarUrl`, `preferredCurrency`, `language`, `monthlyStartDate`, `notificationPreferences` | `200 OK` (`UserProfile` object)               | Updates profile settings and user preferences                |
| `exportUserData`     | `GET`   | `/api/v1/profile/export`     | None                                                                                                | `200 OK` (binary downloadable blob / archive) | Exports all user financial records and preferences           |
| `clearAllUserData`   | `POST`  | `/api/v1/profile/clear-data` | `confirmation: "DELETE"`                                                                            | `200 OK` (`success: true`, `message`)         | Clears all financial data while retaining account identity   |

## 6. Acceptance Criteria

- User can view their profile name, email, avatar, and preference settings.
- User can update display name and profile settings with immediate UI reflection.
- Changing preferred currency updates formatted amounts across dependent views.
- User can toggle notification preferences (budget alerts, goal reminders, weekly summaries).
- Clicking "Export Data" triggers downloading an archive containing user financial history.
- Clicking "Clear All Data" displays a high-severity confirmation modal requiring confirmation.
- Confirming data deletion purges transactions, budgets, and goals while keeping the user account intact.
