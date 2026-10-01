---
id: profile
title: User Profile and Preferences
status: active
version: 1.0.0
owner: user-platform-team
last_updated: 2026-10-01
coverage_target: 85
compliance_relevant: true
dependencies:
  - auth
changelog:
  - version: 1.0.0
    date: 2026-10-01
    summary: "Specification for FinTrack user profile details, application settings, notification preferences, data export, account data wipe, and change password flow; corrected currency enum to include INR and clarified preferences editability"
---

# Feature Specification: User Profile and Preferences

## 1. Overview

The Profile module manages the user's account identity, regional preferences, application-wide financial cycles, notification triggers, and data controls. Because it defines core application settings like `preferredCurrency`, `monthlyStartDate`, and account authentication, it serves as an essential configuration provider across all modules. In v1.0.0, regional and cycle preferences are initialized to system defaults upon profile creation, while personal identity details and notifications remain user-configurable.

## 2. Data Model (`UserProfile`)

| Field                                         | Type          | Required | Description                                                                      |
| :-------------------------------------------- | :------------ | :------- | :------------------------------------------------------------------------------- |
| `id`                                          | UUID string   | Yes      | Unique identifier (Primary Key)                                                  |
| `name`                                        | string        | Yes      | Display name (2-100 characters, e.g., "Piyush Kumar")                            |
| `email`                                       | string        | Yes      | Unique, valid email address                                                      |
| `avatarUrl`                                   | string        | No       | URL or local path to profile picture asset                                       |
| `preferredCurrency`                           | enum          | Yes      | ISO currency code (`"INR"`, `"NPR"`, `"USD"`, `"EUR"`, `"GBP"`; default `"INR"`) |
| `language`                                    | enum          | Yes      | Language locale code (`"en_US"`, `"en_GB"`, `"es"`, `"fr"`; default `"en_US"`)   |
| `monthlyStartDate`                            | number        | Yes      | Day of month for budget/accounting cycle start (1–28; default `1`)               |
| `notificationPreferences`                     | object        | Yes      | Key-value settings for notification dispatch                                     |
| `notificationPreferences.budgetLimitAlerts`   | boolean       | Yes      | Whether to dispatch budget threshold alerts (default `true`)                     |
| `notificationPreferences.goalReminders`       | boolean       | Yes      | Whether to dispatch periodic savings goal reminders (default `true`)             |
| `notificationPreferences.weeklySummaryEmails` | boolean       | Yes      | Whether to send weekly summary digest emails (default `true`)                    |
| `createdAt`                                   | ISO Timestamp | Yes      | Profile record creation timestamp                                                |
| `updatedAt`                                   | ISO Timestamp | Yes      | Last update timestamp                                                            |

## 3. Functional Requirements

### REQ-PROF-01: Profile Identity Card

- Displays user avatar circle alongside display Name and Email address.
- Action Buttons:
  - **Edit Profile**: Primary teal button launching personal info update flow.
  - **Change Password**: Secondary light gray/blue button launching password update workflow.

### REQ-PROF-02: Preferences and Settings Card

- Displays system configuration values in label-value layout:
  - **Preferred Currency**: Current currency formatting representation (e.g., `INR (₹)`).
  - **Language**: Display language code and label (e.g., `English (EN)`).
  - **Monthly Start Date**: Beginning of monthly accounting and budgeting period (e.g., `1st of every month`).
- Note: In v1.0.0, **Preferred Currency**, **Language**, and **Monthly Start Date** are displayed in read-only label-value layout based on user defaults; user editing of these three settings is deferred to v1.1.0.
- **Notification Preferences**: Interactive checkbox controls allowing users to toggle:
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

### Profile Information Validation

- `name`: Must be between 2 and 100 characters.
- `email`: Must be a valid email format.
- `monthlyStartDate`: Integer between 1 and 28 (to ensure compatibility across all calendar months).
- `Clear All Data`: Requires explicit confirmation string input (e.g., typing "DELETE" or confirming via modal dialog) before triggering data deletion.

### Change Password Validation & Security Rules

- `currentPassword`: Required. Must match the authenticated user's current password stored in the authentication provider. If incorrect, returns `401 INVALID_CREDENTIALS`. For Google SSO accounts without an established password (`passwordHash` is `null`), returns `400 PASSWORD_NOT_SET` directing the user to use password recovery.
- `newPassword`: Must be at least 8 characters long, containing at least one digit and one special character (any non-alphanumeric character, consistent with auth specification). Cannot be identical to `currentPassword` (returns `400 SAME_PASSWORD`).
- `confirmPassword`: Required. Must exactly match `newPassword` (returns `400 PASSWORDS_DO_NOT_MATCH` if different).
- `Rate Limiting / Lockout`: Password change submissions are rate-limited to a maximum of 5 failed attempts per rolling 15-minute window per user. Exceeding this limit returns `429 RATE_LIMIT_EXCEEDED`.
- `Session Revocation`: On successful password change, all active refresh tokens for the user are revoked.

## 5. API / Interface Specification

### Profile Endpoints

| API / Operation Name | Method  | Endpoint                          | Request Body                                        | Success Status / Response                     | Description                                                          |
| :------------------- | :------ | :-------------------------------- | :-------------------------------------------------- | :-------------------------------------------- | :------------------------------------------------------------------- |
| `getUserProfile`     | `GET`   | `/api/v1/profile`                 | None                                                | `200 OK` (`UserProfile` object)               | Retrieves current authenticated user profile and preferences         |
| `updateUserProfile`  | `PATCH` | `/api/v1/profile`                 | `name`, `avatarUrl`, `notificationPreferences`      | `200 OK` (`UserProfile` object)               | Updates user personal details and notification preferences           |
| `changePassword`     | `POST`  | `/api/v1/profile/change-password` | `currentPassword`, `newPassword`, `confirmPassword` | `200 OK` (`success: true`, `message: string`) | Authenticated endpoint allowing users to update their login password |
| `exportUserData`     | `GET`   | `/api/v1/profile/export`          | None                                                | `200 OK` (binary downloadable blob / archive) | Exports all user financial records and preferences                   |
| `clearAllUserData`   | `POST`  | `/api/v1/profile/clear-data`      | `confirmation: "DELETE"`                            | `200 OK` (`success: true`, `message: string`) | Clears all financial data while retaining account identity           |

### Error Responses

| Status | `code`                   | When                                                                                                              |
| :----- | :----------------------- | :---------------------------------------------------------------------------------------------------------------- |
| `400`  | `VALIDATION_ERROR`       | Request body fails validation (e.g., name length, password complexity under 8 chars / missing digit/special char) |
| `400`  | `PASSWORD_NOT_SET`       | User signed up via Google SSO and has no existing password set                                                    |
| `400`  | `SAME_PASSWORD`          | `newPassword` matches `currentPassword`                                                                           |
| `400`  | `PASSWORDS_DO_NOT_MATCH` | `confirmPassword` does not match `newPassword`                                                                    |
| `401`  | `INVALID_CREDENTIALS`    | `currentPassword` does not match the user's existing password                                                     |
| `401`  | `UNAUTHENTICATED`        | Missing, malformed, or expired Bearer access token                                                                |
| `429`  | `RATE_LIMIT_EXCEEDED`    | More than 5 failed password change attempts within 15 minutes                                                     |

## 6. Acceptance Criteria

- User can view their profile name, email, avatar, and preference settings (preferred currency, language, monthly start date).
- User can update display name and avatar via the "Edit Profile" dialog with immediate UI reflection. (Note: In v1.0.0, "update profile settings" acceptance criteria refers only to name/avatar; preferredCurrency, language, and monthlyStartDate are read-only display values initialized from account defaults, with user editing deferred to v1.1.0).
- User can toggle notification preferences (budget alerts, goal reminders, weekly summaries) with automatic saving and immediate reflection.
- User can open the Change Password modal from the Profile Identity card, enter current password and new password with confirmation, and successfully change password with immediate success toast notification.
- Submitting an invalid current password, an unmet password complexity rule, or a mismatched confirmation password displays corresponding inline validation error feedback without changing credentials.
- Users with Google SSO accounts who have not set a password receive clear guidance directing them to the password reset flow.
- Clicking "Export Data" triggers downloading an archive containing user financial history.
- Clicking "Clear All Data" displays a high-severity confirmation modal requiring confirmation.
- Confirming data deletion purges transactions, budgets, and goals while keeping the user account intact.
