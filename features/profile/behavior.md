# Behavior Specification: User Profile and Preferences

## 1. Page Access & Layout

- Clicking the User Profile avatar icon in the top right of the navigation header navigates to `/profile`.
  - _Addendum (v1.0.0, directive D-16):_ The shared navigation header that hosts this avatar icon is not built by `profile` v1.0.0. It must render identically across `/dashboard`, `/transactions`, and other pages, which makes it a future cross-feature/app-shell effort rather than a `profile`-owned component. `profile` v1.0.0 assumes `/profile` is reached directly; see `plan.md` Decision Log D-13.
- Page layout renders two primary cards side by side under the header **"My Profile"**:
  1. Profile Identity Card (Left).
  2. Preferences, Notifications, and Data Management Card (Right).

## 2. Profile Details & Password Flow

- **Edit Profile**:
  - Clicking **"Edit Profile"** opens an edit dialog for display name and avatar upload.
  - Saving updates values immediately and syncs with global user state.
- **Change Password**:
  - Clicking **"Change Password"** opens a modal requesting current password, new password, and confirmation.
  - Submitting successfully updates the password, closes the modal, and displays a confirmation toast: `"Password updated successfully!"`.
  - Submitting an incorrect current password displays an inline error: `"Incorrect current password."`.
  - Submitting a new password that does not meet complexity requirements (minimum 8 characters, at least one number, and at least one special character) or where confirmation does not match displays corresponding inline validation errors.
  - For Google SSO accounts without a password, an alert informs the user that no password has been set and directs them to use password recovery.

## 3. Preferences & Notification Toggling

- Checking or unchecking any of the notification preferences (**Budget Limit Alerts**, **Goal Reminders**, **Weekly Summary Emails**) saves automatically or upon settings submission, updating notification triggers.
- In v1.0.0, **Preferred Currency** (`NPR (₹)`), **Language** (`English (EN)`), and **Monthly Start Date** (`1st of every month`) are rendered as static, read-only labels based on account defaults; user editing controls for regional/cycle preferences are deferred to v1.1.0.

## 4. Data Export Flow

- Clicking the teal **"Export Data"** button initiates an asynchronous compilation of user data.
- Once ready, the browser automatically triggers download of the compressed export archive.
- A success toast notification is displayed: `"Your data has been exported successfully."`

## 5. Clear All Data Flow

- Clicking the red **"Clear All Data"** button opens a high-priority destructive warning modal:
  - Message: _"Are you sure you want to clear all data? This will permanently erase all transactions, budgets, and goals. This action cannot be undone."_
- User must confirm the action.
- On confirmation:
  - Deletes all transaction records, budget categories, and goals associated with the account.
  - Resets all dashboard summaries to empty baseline states.
  - Shows an alert toast: `"All financial records have been cleared."`
