# Behavior Specification: User Profile and Preferences

## 1. Page Access & Layout

- Clicking the User Profile avatar icon in the top right of the navigation header navigates to `/profile`.
- Page layout renders two primary cards side by side under the header **"My Profile"**:
  1. Profile Identity Card (Left).
  2. Preferences, Notifications, and Data Management Card (Right).

## 2. Profile Details & Password Flow

- **Edit Profile**:
  - Clicking **"Edit Profile"** opens an edit dialog for display name, email, and avatar upload.
  - Saving updates values immediately and syncs with global user state.
- **Change Password**:
  - Clicking **"Change Password"** opens a modal requesting current password, new password, and confirmation.
  - Submitting successfully displays a confirmation toast: `"Password updated successfully!"`

## 3. Preferences & Notification Toggling

- Checking or unchecking any of the notification preferences (**Budget Limit Alerts**, **Goal Reminders**, **Weekly Summary Emails**) saves automatically or upon settings submission, updating notification triggers.
- Adjusting **Monthly Start Date** recalculates budget monthly cycle periods application-wide.

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
