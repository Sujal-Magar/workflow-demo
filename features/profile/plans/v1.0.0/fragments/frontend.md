# Frontend Fragment — `profile` v1.0.0

> **SUPERSEDED.** Stale after revision 4. Kept as an audit trail only; do not use as synthesis input. The authoritative sources are `../plan.md` and `../contract.md`.

**Author**: Frontend Plan Fragment agent (Phase 1, revision run)
**Inputs read**: `features/profile/fds.md` (v1.0.0), `features/profile/behavior.md`, `features/profile/visuals/profile-page.png`, `features/profile/plans/v1.0.0/directives.md`, `rules/architecture.md`, `rules/conventions.md`, `rules/tech-stack.md`, `features/index.json`, existing `frontend/src` tree (patterns from the `auth` feature).
**Scope**: Frontend + Frontend-Testing only. No backend, integration, or formal API contract content. The Plan Synthesizer reconciles this with the independently drafted Backend Fragment.

## 0. Directive Applied

**D-02 (Scope of Edit Profile Dialog — Email Editability)**: The Edit Profile dialog in this fragment edits **display name and avatar upload only**. It does **not** include an email field or email validation/UX. Email is rendered read-only on the Identity Card. D-01 is a backend-only directive (export/clear-data scoping) and is not applied here — this fragment treats `exportUserData` and `clearAllUserData` purely as frontend-triggered actions with no assumption about what server-side data they touch.

## 1. Route & Page Structure

- New route: `frontend/src/app/(protected)/profile/page.tsx`, mounted inside the existing `(protected)` route group (`frontend/src/app/(protected)/layout.tsx`), consistent with how `/dashboard` is mounted. `ProtectedRoute` already guards this group, so the page can assume an authenticated session.
- Page composition mirrors the two-card visual layout (`features/profile/visuals/profile-page.png`): a page heading **"My Profile"**, then a two-column (stacking to one column on small viewports) layout:
  - Left: `ProfileIdentityCard`
  - Right: `PreferencesCard`
- **Out of scope / open item**: the visual mockup shows a full app shell (top nav with Dashboard/Transactions/Budget/Goals/Reports links and a header avatar icon that behavior.md §1 says navigates to `/profile`). No shared header/nav component exists yet anywhere in `frontend/src` (the current `/dashboard` route is a bare placeholder with no nav chrome). Building that global shell is not within `profile`'s FDS requirements (REQ-PROF-01 through 04 only describe the page's own content). This fragment builds only the `/profile` page content; wiring a future shared header's avatar icon to route to `/profile` is flagged as a cross-feature follow-up, not built here.

## 2. Component Breakdown

All new components live under `frontend/src/features/profile/`, mirroring the `features/auth/` layout (`api/`, `components/`, `hooks/`, `lib/`).

- `app/(protected)/profile/page.tsx` — thin page shell; renders `ProfilePage` feature component once the profile query has data (loading/error handled inside, per existing `DashboardPage` pattern of returning `null` while the shell resolves auth).
- `features/profile/components/profile-page.tsx` — composes the two cards, owns the top-level loading/error state for the `useProfile` query.
- `features/profile/components/profile-identity-card.tsx` — avatar circle (image if `avatarUrl` set, else an initials/placeholder circle matching the checkerboard placeholder in the visual), `Name: {name}`, `Email: {email}` (read-only, label-value text per the visual), **Edit Profile** button (primary/teal, reuses `Button` variant `primary`), **Change Password** button (needs a new secondary/light variant added to `buttonVariants` in `components/ui/button.tsx` — light gray/blue per REQ-PROF-01, not currently defined; flagged as a small shared UI addition, not a new library).
- `features/profile/components/edit-profile-dialog.tsx` — Radix `Dialog` (same structural pattern as `ForgotPasswordDialog`): trigger is the "Edit Profile" button, content holds the form described in §4. Scoped per D-02 to name + avatar only.
- `features/profile/components/change-password-dialog.tsx` — Radix `Dialog`, trigger is "Change Password" button, content holds the form described in §4.
- `features/profile/components/preferences-card.tsx` — composes `ReadOnlyPreferencesList` + `NotificationPreferencesList` + `DataManagementActions`.
- `features/profile/components/read-only-preferences-list.tsx` — label-value rows for Preferred Currency (formatted as `"{code} ({symbol})"`, e.g. `NPR (₹)`), Language (formatted as `"{label} ({CODE})"`, e.g. `English (EN)`), Monthly Start Date (formatted as an ordinal, e.g. `1st of every month`). Pure presentation, no inputs — v1.0.0 keeps these read-only per FDS §3 note.
- `features/profile/components/notification-preferences-list.tsx` — three checkboxes (Budget Limit Alerts, Goal Reminders, Weekly Summary Emails), each wired independently so toggling one does not require re-submitting the others.
- `features/profile/components/data-management-actions.tsx` — "Export Data" button (teal/primary) and "Clear All Data" button (destructive/red — needs a `destructive` variant added to `buttonVariants`).
- `features/profile/components/clear-all-data-dialog.tsx` — Radix `AlertDialog`-style confirmation (project currently only has `@radix-ui/react-dialog` installed, not `@radix-ui/react-alert-dialog`; this fragment proposes reusing `Dialog` with `role="alertdialog"` semantics rather than adding a new Radix package, to respect "No new libraries without explicit approval"). Shows the exact warning copy from behavior.md §5, requires an explicit confirmation step before the destructive mutation fires (see §4).
- `features/profile/components/avatar-circle.tsx` — small presentational component, reused by `ProfileIdentityCard` and inside `EditProfileDialog`'s live preview.

## 3. Data Fetching & Mock Data Shapes

- `features/profile/hooks/use-profile.ts` — `useProfile()`, a `useQuery` over the profile read endpoint (query key `["profile"]`), mirroring `useCurrentUser`'s shape. No `sessionUser` seed is available the way auth's `PublicUser` seeds `useCurrentUser` (the existing `PublicUser` contract type only carries `id`, `name`, `email` — no `avatarUrl` or preferences), so this query has its own loading state shown as a skeleton/placeholder on both cards.
- Mock data shape to build the UI against, matching `fds.md` §2 `UserProfile` exactly:

```ts
interface MockUserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  preferredCurrency: "NPR" | "USD" | "EUR" | "GBP";
  language: "en_US" | "en_GB" | "es" | "fr";
  monthlyStartDate: number; // 1-28
  notificationPreferences: {
    budgetLimitAlerts: boolean;
    goalReminders: boolean;
    weeklySummaryEmails: boolean;
  };
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}
```

Fixture lives at `frontend/src/features/profile/test/mock-profile.ts` (or `frontend/src/test/` if the Synthesizer prefers a shared location, matching `frontend/src/test/render-with-providers.tsx`'s existing `TEST_SESSION` pattern).

- Mutations (each a `useMutation`-backed hook under `features/profile/hooks/`, following the `useSignIn` / `useRequestPasswordReset` result-union pattern — `{ ok: true, data }` or `{ ok: false, failure }`, never throwing for expected failures):
  - `use-update-profile.ts` — `useUpdateProfile()`: submits `{ name, avatarUrl }` from the Edit Profile dialog. On success, updates the `["profile"]` query cache (`setQueryData` or `invalidateQueries`) so the Identity Card reflects the change immediately (behavior.md §2: "Saving updates values immediately and syncs with global user state" — interpreted here as the shared TanStack Query cache for `["profile"]`, since the separate `PublicUser`/auth session object does not carry `name`/`avatarUrl` fields today).
  - `use-toggle-notification-preference.ts` — `useToggleNotificationPreference()`: submits a single `{ notificationPreferences: { [key]: boolean } }` change per checkbox toggle, independent of the Edit Profile flow. Optimistically flips the checkbox, rolls back on failure with an inline/toast error (behavior.md §3: "saves automatically").
  - `use-change-password.ts` — `useChangePassword()`: submits `{ currentPassword, newPassword, confirmPassword }`.
  - `use-export-data.ts` — `useExportData()`: triggers the export; on success, hands the frontend a blob/URL to download (exact transport TBD by Synthesizer — see §5).
  - `use-clear-all-data.ts` — `useClearAllData()`: submits the confirmation and, on success, invalidates the `["profile"]` query (and any other locally cached feature data, none of which exists yet in this codebase) so the UI reflects the reset state.

## 4. Forms, Validation UX, and Interaction Details

### Edit Profile dialog (D-02 scope: name + avatar only)

- Fields:
  - **Display Name** — text input, required, 2–100 characters (fds.md §4), React Hook Form + Zod resolver, inline `FieldError` on blur/submit (mirrors `IconInput`/`FieldError` pattern from `auth`).
  - **Avatar** — file picker (`<input type="file" accept="image/*">`) with an immediate local preview (`URL.createObjectURL`) rendered in `AvatarCircle` before save, plus a way to clear/remove the currently set avatar back to the placeholder. Client-side UX constraints (accepted image types, a reasonable max file size for the preview) are frontend-only guardrails since the FDS does not specify them; the authoritative constraint is whatever the backend declares once the Synthesizer reconciles this.
  - No email field, per D-02.
- Submit: disabled while pending (`isLoading` on the submit `Button`, same as `SignInForm`/`ForgotPasswordBody`); on success the dialog closes and the Identity Card reflects the new name/avatar immediately (query cache update, see §3); on failure shows a `FormAlert` (generic) or field-level errors if the backend returns field-scoped validation (`VALIDATION_ERROR`).

### Change Password dialog

- Fields: **Current Password**, **New Password**, **Confirm New Password** — all via the existing `PasswordInput` component pattern (`components/ui/password-input.tsx`), mirroring `auth`'s sign-up/reset-password forms.
- Client-side validation mirrors fds.md §4 for instant feedback (authoritative check stays server-side per `rules/architecture.md`):
  - `newPassword`: min 8 chars, at least one digit, at least one special character.
  - `confirmPassword` must match `newPassword`.
- Server-driven inline errors mapped from documented error codes (fds.md §5 Error Responses table), matching exact behavior.md §2 copy:
  - `401 INVALID_CREDENTIALS` → inline error "Incorrect current password." on the Current Password field.
  - `400 VALIDATION_ERROR` (complexity) → inline error on New Password.
  - `400 PASSWORDS_DO_NOT_MATCH` → inline error on Confirm New Password.
  - `400 SAME_PASSWORD` → inline error on New Password (new password must differ from current).
  - `400 PASSWORD_NOT_SET` (Google SSO account with no password) → non-field alert directing the user to password recovery; behavior.md §2 describes this case as occurring before/instead of a normal submission flow, so the dialog should also proactively surface this guidance as soon as it detects the account has no password set, if that is knowable from the already-loaded profile/session data — otherwise it surfaces on first submit attempt. (Exact detection mechanism — i.e., whether the frontend has a `hasPassword` flag available before submit — is a read-intent listed in §5; this dialog degrades gracefully to "surface on submit" if that flag isn't available.)
  - `429 RATE_LIMIT_EXCEEDED` → non-field alert, submit disabled with a clear "too many attempts" message.
- On success: dialog closes, toast `"Password updated successfully!"` via the existing `useToast().success(...)` (`components/ui/toast.tsx`).

### Notification Preferences checkboxes

- Each of the three checkboxes (Budget Limit Alerts, Goal Reminders, Weekly Summary Emails) is independently interactive and self-saving on change (behavior.md §3). Uses Radix-free native `<input type="checkbox">` (no checkbox primitive exists yet in `components/ui/`; this fragment proposes adding a small shared `Checkbox` presentational component rather than a new Radix dependency, since none of `@radix-ui/react-checkbox` is currently installed and the visual's checkbox styling is simple).
- Optimistic toggle with rollback-on-failure and a toast/inline error on failure (no explicit copy specified in behavior.md for this failure case — proposed generic copy: "Couldn't update your notification preference. Please try again.").

### Export Data

- Button shows a pending state (`isLoading`) while the export is in flight (behavior.md §4: "initiates an asynchronous compilation").
- On success: browser-triggered download of the archive, then toast `"Your data has been exported successfully."`.
- On failure: toast/alert with a generic retry message (not specified in behavior.md; proposed: "Couldn't export your data. Please try again.").

### Clear All Data

- Confirmation dialog shows the exact warning copy from behavior.md §5. fds.md §4 additionally requires "explicit confirmation string input (e.g., typing 'DELETE')." This fragment adopts the literal `fds.md` wording and designs the confirmation dialog with a text input where the user must type `DELETE` before the destructive action button becomes enabled, matching the pattern already implied by the API's `confirmation: "DELETE"` request field named in fds.md §5's endpoint table.
- On confirm: submits, shows pending state, closes dialog, resets any cached local state for cleared sections, shows toast `"All financial records have been cleared."`.
- On failure: dialog stays open (or reopens) with an inline alert; no specific copy given in behavior.md — proposed generic: "Couldn't clear your data. Please try again."

## 5. What the Frontend Needs From the Backend (plain-language intents, not a formal contract)

For each screen/interaction, the field lists and intents the frontend needs to build against:

1. **Profile read (page load)** — needs to read the full `UserProfile` record for the current authenticated user: `id`, `name`, `email`, `avatarUrl`, `preferredCurrency`, `language`, `monthlyStartDate`, `notificationPreferences` (all three booleans), `createdAt`, `updatedAt`. No request parameters beyond the authenticated session.
2. **Edit Profile save** — needs to write a changed `name` and/or a new avatar image, and get back the updated `name`/`avatarUrl` (and ideally the full updated `UserProfile`, for cache consistency) so the UI can reflect the save immediately without a second round trip. Needs to know how an avatar image file becomes a stored `avatarUrl` (e.g., whether the frontend uploads a file and receives a URL back, or sends something else) — this is a backend-owned mechanism the Synthesizer should pin down; the frontend only needs _some_ way to turn a locally-picked image into a persisted `avatarUrl`.
3. **Notification preference toggle** — needs to write a single changed boolean within `notificationPreferences` (one of `budgetLimitAlerts`, `goalReminders`, `weeklySummaryEmails`) independently of the name/avatar save, and get back confirmation (and ideally the resulting full `notificationPreferences` object, in case of concurrent changes).
4. **Change Password** — needs to write `currentPassword`, `newPassword`, `confirmPassword` and get back either a success acknowledgment or one of the documented field/account-level error codes (`INVALID_CREDENTIALS`, `PASSWORD_NOT_SET`, `SAME_PASSWORD`, `PASSWORDS_DO_NOT_MATCH`, `VALIDATION_ERROR`, `RATE_LIMIT_EXCEEDED`) so the dialog can show the exact behavior.md-specified inline messages. Needs to know (ideally from the profile read, or inline on error) whether the current account has a password set at all, to support the Google-SSO-no-password guidance proactively rather than only reactively on submit.
5. **Export Data** — needs to trigger an export and receive something the browser can turn into a downloaded file (a direct downloadable response, or a URL to fetch/redirect to). Needs to know whether this is synchronous (one request, response is the file) or asynchronous (kick off a job, poll or wait for readiness) — behavior.md's "asynchronous compilation" phrasing suggests the UI should show a pending/spinner state regardless, but the frontend needs the backend to specify which interaction shape it is so the "pending" UI either covers one request or a poll loop.
6. **Clear All Data** — needs to write an explicit confirmation value (the user-typed `"DELETE"` string, per fds.md §4) and get back a success acknowledgment or a failure, so the UI can show the specified toast or a retry message.

## 6. Empty / Loading / Error States

- **Initial load**: both cards show a lightweight skeleton/placeholder (no spec-mandated copy or visual — proposed: simple pulse/skeleton blocks matching card dimensions) while `useProfile()` is pending.
- **Load failure**: page-level error state with a retry action (no copy specified — proposed generic "Couldn't load your profile. Please try again."), since there is no reasonable fallback UI for a profile page that can't read its own data.
- **Edit Profile / Change Password dialogs**: standard pending (`isLoading` on submit button, inputs stay editable per existing auth dialog pattern) → success (close + reflect/toast) → failure (inline/field errors, dialog stays open) states, consistent with `ForgotPasswordDialog`'s existing pattern.
- **Export Data**: idle → pending (button `isLoading`) → success (toast, no state change on page) → error (toast/alert, button returns to idle, retry-able).
- **Clear All Data**: idle → confirmation dialog open → pending (confirm button `isLoading`, confirmation input locked) → success (dialog closes, toast, preferences/notification section optionally refetched) → error (dialog stays open with inline alert, retry-able).
- **Notification toggles**: idle → optimistic-checked → confirmed (no visible change) / rollback-on-failure (checkbox reverts, error surfaced).

## 7. Component & End-to-End Test Requirements (implied by `behavior.md`)

### Component/unit tests (Vitest + Testing Library, mirroring `frontend/src/features/auth/components/*.test.tsx` conventions — `renderWithProviders`, `vi.mock` of the feature's `api` module)

- `profile-page.test.tsx`: renders loading state, then both cards once `useProfile` resolves; renders the page-level error/retry state on query failure.
- `profile-identity-card.test.tsx`: renders `Name:`/`Email:` text, avatar placeholder when `avatarUrl` is absent, avatar image when present; both action buttons present and open their respective dialogs on click.
- `edit-profile-dialog.test.tsx`: renders only Name + avatar controls (asserts **no** email field is present, directly covering D-02); validates name length client-side; submits and closes on success; shows alert on failure; avatar file selection updates the live preview.
- `change-password-dialog.test.tsx`: renders all three password fields; client-side validation for complexity/mismatch; maps each documented error code to its exact specified inline copy (`"Incorrect current password."`, etc.); success path shows the exact toast copy `"Password updated successfully!"` and closes the dialog; Google-SSO/no-password guidance renders correctly.
- `preferences-card.test.tsx` / `read-only-preferences-list.test.tsx`: renders the three read-only values in the specified display format (`NPR (₹)`, `English (EN)`, `1st of every month`) and confirms no inputs/edit affordance exists for them in v1.0.0.
- `notification-preferences-list.test.tsx`: each checkbox toggles independently; toggling one does not change the others; optimistic update and rollback-on-failure behavior.
- `data-management-actions.test.tsx` / `clear-all-data-dialog.test.tsx`: Export Data triggers the mutation and shows the exact toast copy `"Your data has been exported successfully."`; Clear All Data shows the exact warning copy from behavior.md §5, disables confirmation until `"DELETE"` is typed, and shows the exact toast copy `"All financial records have been cleared."` on success.

### End-to-end tests (Playwright, new `e2e/profile-*.spec.ts` files, following the existing `e2e/auth-*.spec.ts` + `e2e/support/auth.ts` session-bootstrap pattern)

- `e2e/profile-view-and-edit.spec.ts`: signed-in user navigates to `/profile` (direct URL, since the shared nav header doesn't exist yet per §1), sees identity + preferences data, edits display name and avatar via the dialog, sees the Identity Card update immediately without a page reload.
- `e2e/profile-change-password.spec.ts`: full change-password happy path ending in the exact success toast; incorrect-current-password path showing the exact inline error; complexity/mismatch validation paths.
- `e2e/profile-notifications.spec.ts`: toggling each notification checkbox persists across a page reload (reads back from the backend).
- `e2e/profile-export-data.spec.ts`: clicking Export Data results in a downloaded file and the exact success toast (Playwright's download event assertion).
- `e2e/profile-clear-data.spec.ts`: Clear All Data requires typing `DELETE` to enable confirmation, and on confirm shows the exact success toast and the account remains signed in afterward (profile identity persists; only the warned-about data is cleared).

## 8. Shared UI Additions Needed (flagged for Synthesizer/Build Mode awareness)

Not new libraries — just small additions to existing `components/ui/`:

- A `secondary`/light variant and a `destructive` variant added to `buttonVariants` in `components/ui/button.tsx` (currently only `primary`, `overlay`, `link` exist), needed for "Change Password" (light gray/blue) and "Clear All Data" (red) per REQ-PROF-01 and the visual.
- A small `Checkbox` presentational component under `components/ui/`, since none exists yet and three are needed here (native `<input type="checkbox">` wrapped for consistent styling/label association, no new Radix package).

## 9. Ambiguities Considered and Resolved (not blocking)

These were evaluated and resolved within this fragment rather than escalated, per the bounded-retry instruction to resolve what's resolvable:

- Whether "syncs with global user state" (behavior.md §2) means the shared auth session object: resolved as referring to the shared TanStack Query cache for the profile's own `["profile"]` query, since the auth `PublicUser` contract type has no `name`/`avatarUrl` fields to sync into.
- Whether the global nav header (avatar icon → `/profile`) is in scope: resolved as out of scope for this feature (no such shared component exists yet in the codebase; FDS requirements for `profile` don't describe building it).
- Avatar upload transport mechanism: resolved as a backend-owned detail; frontend only commits to "some way to turn a local file into a persisted `avatarUrl`," listed as an open backend-needs item in §5.
- Export Data synchronous-vs-asynchronous transport: resolved the same way — frontend shows a pending state regardless, exact shape listed as an open backend-needs item in §5.
