# Frontend Fragment — `transactions` v1.0.0

> **SUPERSEDED.** Stale after revision 1. Kept as an audit trail only; do not use as synthesis input. The authoritative sources are `../plan.md` and `../contract.md`.

**Author**: Frontend Plan Fragment agent (Phase 1, fresh run — no directives exist)
**Inputs read**: `features/transactions/fds.md` (v1.0.0), `features/transactions/behavior.md`, `features/transactions/visuals/*.png`, `rules/architecture.md`, `rules/conventions.md`, `rules/tech-stack.md`, `features/index.json`, existing `frontend/src` tree (patterns from the already-built `auth` and `profile` features — component/hook/api layout, `Button`/`Checkbox`/`IconInput`/`FieldError`/`FormAlert`/`useToast`/toast primitives, ts-rest client wiring in `lib/api-client.ts`, result-union API modules such as `features/profile/api/profile-api.ts`).
**Scope**: Frontend + Frontend-Testing only. No backend, integration, or formal API contract content. The Plan Synthesizer reconciles this with the independently drafted Backend Fragment. This fragment does not read or assume the contents of `fragments/backend.md`.

## 1. Route & Page Structure

- New route: `frontend/src/app/(protected)/transactions/page.tsx`, mounted inside the existing `(protected)` route group (`frontend/src/app/(protected)/layout.tsx`), the same pattern used by `/dashboard` and `/profile`. `ProtectedRoute` already guards this group, so the page can assume an authenticated session (fds.md frontmatter `dependencies: [auth, profile]` — auth for the guard, profile for the signed-in user's `preferredCurrency`, used in §4 amount formatting).
- Page composition mirrors `features/transactions/visuals/transactions-page.png`: an `"Transactions"` heading, a right-aligned `"+ Add Transaction"` primary button, a filter/sort toolbar row (Timeframe, Category, Type, Sort selects), the ledger table (Date, Category, Description, Amount, Type badge, Actions), and pagination controls below the table.
- **Out of scope / open item, consistent with the precedent already set in `features/profile/plans/v1.0.0/fragments/frontend.md` §1**: the visual mockup shows a full app shell — `FinTrack` logo, a top nav bar (Dashboard / Transactions / Budget / Goals / Reports, with "Transactions" underlined as the active link), and two header icons on the right. No shared header/nav component exists anywhere in `frontend/src` today (confirmed by inspecting the current tree — `/dashboard` and `/profile` are both bare content with no nav chrome). Building that global shell is not implied by any of `transactions`' FDS requirements (REQ-TXN-01 through 04 describe only the page's own content). This fragment builds only the `/transactions` page content; the shared nav shell remains a cross-feature follow-up (now observed in a second feature's visuals, which strengthens the case that it should be picked up as its own small piece of work soon, but that decision belongs to the developer/orchestrator, not this fragment).

## 2. Component Breakdown

All new components live under `frontend/src/features/transactions/`, mirroring the `api/`, `components/`, `hooks/`, `lib/` layout used by `auth` and `profile`.

- `app/(protected)/transactions/page.tsx` — thin page shell; renders `TransactionsPage`.
- `features/transactions/components/transactions-page.tsx` — owns filter/pagination state (`timeframe`, `category`, `type`, `sort`, `page`), composes the toolbar, filter bar, table, and pagination; owns the top-level loading/error state for the `useTransactions` query.
- `features/transactions/components/transactions-toolbar.tsx` — page heading + `"+ Add Transaction"` button (opens `AddTransactionDialog`).
- `features/transactions/components/transaction-filters.tsx` — the four selects (Timeframe, Category, Type, Sort). Changing any of them calls back up to `TransactionsPage` to update the relevant filter **and reset `page` to 1** (behavior.md §1: "Adjusting any filter re-queries transactions and resets pagination back to page 1").
- `features/transactions/components/transactions-table.tsx` — renders the header row and maps `Transaction[]` to `TransactionRow`; renders the empty-state row when the filtered result set is empty (no FDS/behavior.md copy specified — see §6).
- `features/transactions/components/transaction-row.tsx` — one ledger row: formatted date, `CategoryIcon` + category label, description, formatted amount (§4), `TransactionTypeBadge`, and the yellow edit / red delete action buttons.
- `features/transactions/components/transaction-type-badge.tsx` — small pill, green/`Income` or red/`Expense`, matching the visual's two badge colors.
- `features/transactions/components/category-icon.tsx` — maps each of the 10 `category` enum values to a small circular icon, per the visual (fork/knife for `food_and_dining`, briefcase for `salary`, car for `transportation`, bag for `shopping`, `$` for `investment`, laptop for `freelance_work`, clipboard for `bills_and_utilities`, medical cross for `health_and_fitness`, piggy bank for `savings_account`, and a generic icon for `others`, which the visual's sample rows don't show an example of).
- `features/transactions/components/pagination-controls.tsx` — `"Prev"`, numbered page buttons, `"Next"`, matching the visual; disables `"Prev"`/`"Next"` at the first/last page.
- `features/transactions/components/add-transaction-dialog.tsx` — Radix `Dialog` (same structural pattern as `EditProfileDialog`/`ForgotPasswordDialog`): trigger is the `"+ Add Transaction"` button, content holds `TransactionFormFields` (shared with Edit, see below) plus an outlined `"Cancel"` and primary teal `"Add"` button.
- `features/transactions/components/edit-transaction-dialog.tsx` — same structure, trigger is the row's pencil icon button, content pre-filled from the selected `Transaction`, actions are outlined `"Cancel"` and primary teal `"Save"`.
- `features/transactions/components/transaction-form-fields.tsx` — the five shared form controls (Date, Description, Category, Type, Amount) used by both Add and Edit dialogs, extracted up front since conventions.md calls for avoiding duplicated logic between two near-identical forms.
- `features/transactions/components/delete-transaction-dialog.tsx` — Radix `Dialog` (same "reuse `Dialog` with `role=\"alertdialog\"` semantics" approach profile's fragment adopted for `ClearAllDataDialog`, since `@radix-ui/react-alert-dialog` is not an installed/approved package): title `"Delete Transaction?"`, body copy `"Are you sure you want to delete this transaction? This action cannot be undone."`, outlined `"Cancel"` and solid red `"Delete"` button (reuses the existing `destructive` `Button` variant).

## 3. Data Fetching & Mock Data Shapes

Mock data shape to build the UI against, matching `fds.md` §2 `Transaction` exactly:

```ts
interface MockTransaction {
  id: string; // UUID
  date: string; // ISO date, "YYYY-MM-DD"
  description: string; // 1–255 chars
  category:
    | "food_and_dining"
    | "salary"
    | "transportation"
    | "shopping"
    | "investment"
    | "freelance_work"
    | "bills_and_utilities"
    | "health_and_fitness"
    | "savings_account"
    | "others";
  type: "income" | "expense";
  amount: number; // always positive; sign/display handled in §4
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

interface MockTransactionFilters {
  page: number;
  limit: number;
  category?: MockTransaction["category"]; // absent/undefined = "All Category"
  type?: MockTransaction["type"]; // absent/undefined = "All Types"
  timeframe: "this_month" | "this_week" | "today" | "this_year" | "all_time"; // see §9 — exact set not specified in fds.md
  sort: "newest" | "oldest";
}

interface MockTransactionListResult {
  data: MockTransaction[];
  total: number; // drives pagination page count
}
```

Fixture lives at `frontend/src/features/transactions/test/mock-transactions.ts`, following `frontend/src/test/render-with-providers.tsx`'s existing fixture pattern.

- `features/transactions/hooks/use-transactions.ts` — `useTransactions(filters)`, a `useQuery` keyed on `["transactions", filters]` (mirrors `useProfile`'s `PROFILE_QUERY_KEY` pattern but parameterized, since this list is filter/page-dependent). Returns `{ data, total }`.
- `features/transactions/hooks/use-create-transaction.ts` — `useCreateTransaction()`: submits `{ date, description, category, type, amount }`. Result-union return (`{ ok: true, data }` / `{ ok: false, failure }`, never throwing for expected failures — same shape as `useUpdateProfile`/`useSignIn`). On success, invalidates the `["transactions"]` query so the ledger refetches with current filters/sort/page (see §9 for why this, not a literal "always at top" insert, is what this fragment builds).
- `features/transactions/hooks/use-update-transaction.ts` — `useUpdateTransaction()`: submits `{ id, date, description, category, type, amount }`; same result-union shape; invalidates `["transactions"]` on success.
- `features/transactions/hooks/use-delete-transaction.ts` — `useDeleteTransaction()`: submits `{ id }`; on success invalidates `["transactions"]` so the row disappears and `total`/pagination recalculate from the refetched response (fds.md REQ-TXN-03: "recalculates totals and pagination" — interpreted as the already-specified `total` field from `getTransactions`'s response driving the pagination control, not a separate on-page summary-stats widget; see §9).
- `features/transactions/api/transactions-api.ts` — one module all hooks go through, following `profile-api.ts`'s `runOperation` pattern (parses a success schema, maps failures via a `toTransactionFailure` helper). Switches from a mock implementation (Build Mode) to the real `@ts-rest/react-query` client (Integration Mode, analogous to `profileApiClient` in `lib/api-client.ts`) without hook/caller signature changes, per the existing `profile-api.ts` precedent.
- `features/transactions/lib/transaction-error.ts` — result-union failure types, mirroring `features/profile/lib/profile-error.ts`'s `ProfileResult`/`ProfileOperation` shape.

## 4. Forms, Validation UX, and Interaction Details

### Shared form fields (`TransactionFormFields`, used by Add and Edit)

Per `fds.md` REQ-TXN-01/02 and `transaction-add-modal.png` / `transaction-edit-modal.png`:

1. **Date** — a calendar-style field. No date-picker library is installed or approved (`frontend/package.json` has no `react-datepicker`/`date-fns`/`dayjs`); this fragment proposes a native `<input type="date">` reusing the existing `IconInput` component (calendar icon in the leading slot via a new `CalendarIcon`, a new `ChevronDownIcon` in the trailing slot to match the dropdown-chevron affordance in the visual) rather than adding a new library. The FDS literally specifies placeholder text `"Title"` (fds.md REQ-TXN-01 item 1, matching the visual exactly) — native date inputs largely ignore a custom `placeholder`, so this is flagged as a minor, non-blocking implementation note (see §9): the field is built to the FDS's literal copy where the browser's date-input rendering allows it, with a styled empty-state label approximating `"Title"` where it doesn't. Required field.
2. **Description** — plain text input, placeholder `"Enter Description"`, required, 1–255 characters (fds.md §2 data model), `FieldError` shown on blur/submit.
3. **Category** — a select-style dropdown defaulting to placeholder `"All Category"`, options are the 10 enum values with their display labels (`Food & Dining`, `Salary`, `Transportation`, `Shopping`, `Investment`, `Freelance Work`, `Bills & Utilities`, `Health & Fitness`, `Savings Account`, `Others`). Required — the placeholder state does not submit.
4. **Type** — a select-style dropdown defaulting to placeholder `"All Types"`, options `Income` / `Expense`. Required — the placeholder state does not submit. (This fragment confirms `category` and `type` are independent fields with no implied mapping between them: the visual's sample rows show `Investment` tagged as `Expense`, so a category never implies a type.)
5. **Amount** — a numeric field, placeholder `"Amount"`, required, must be `> 0` (fds.md data model: "Positive decimal amount"; behavior.md §2: "amount is ≤ 0" is an explicit inline-error condition). The underlying form/submitted value is always a plain positive number, matching the data model. The Edit modal's visual (`-₹450`) is a **display-only** sign/currency adornment layered on top of the raw numeric input (prefix text showing `-` for `Expense` / no sign for `Income`, plus the signed-in user's currency symbol — see below), not part of what's typed or submitted; see §9 for why this fragment reads it this way rather than literally.
   - **Currency symbol**: reuses the exact mapping already established by `profile` (`frontend/src/features/profile/components/read-only-preferences-list.tsx`'s `CURRENCY_SYMBOLS`, where `NPR → "₹"`), sourced from the current user's `UserProfile.preferredCurrency` (via `useProfile()`, already built by the `profile` feature). This is why `fds.md §2`'s `"localized currency symbol (₹)"` is not a frontend ambiguity: `₹` is exactly what that existing mapping already renders for the default `NPR` preference.

Client-side validation is React Hook Form + Zod (`@hookform/resolvers`), matching every existing form in `auth`/`profile`. Inline `FieldError`s shown per-field on submit/blur (`mode: "onSubmit"`, `reValidateMode: "onChange"`, same as `EditProfileDialog`). This is the frontend's own instant-feedback layer; the authoritative check stays server-side per `rules/architecture.md`.

### Add Transaction dialog

- Opens from the `"+ Add Transaction"` toolbar button. Empty `TransactionFormFields` (fds.md REQ-TXN-01: date picker empty or defaulting to today, all other fields at their placeholder state).
- Submit (`"Add"`): on success, closes the dialog, shows green success toast `"Transaction added successfully!"` (exact FDS copy), and the ledger query is invalidated/refetched (see §9 for the "top of table" interpretation).
- On failure: light red error toast `"Failed to add transaction. Please try again."` (exact FDS copy), dialog stays open, all entered field values are preserved (fds.md REQ-TXN-01: "retains user inputs").
- Cancel or backdrop click: dialog closes immediately, all unsaved input discarded (behavior.md §2 step 4).

### Edit Transaction dialog

- Opens from a row's pencil icon, `TransactionFormFields` pre-filled from that row's `Transaction` (date, description, category, type, amount).
- Submit (`"Save"`): on success, closes the dialog, updates the corresponding row (via the invalidated/refetched `["transactions"]` query), shows a success toast. **Exact toast copy is not specified** by fds.md/behavior.md for Edit (only Add's copy is given verbatim) — proposed: `"Transaction updated successfully!"`, flagged in §9 as not literally specified.
- On failure: proposed generic toast `"Failed to update transaction. Please try again."` (mirrors Add's documented error copy pattern), dialog stays open with entered values preserved. Not literally specified; flagged in §9.
- Cancel: closes, discards changes (behavior.md §3 step 4).

### Delete Transaction confirmation

- Opens from a row's trash icon. Title `"Delete Transaction?"`, body `"Are you sure you want to delete this transaction? This action cannot be undone."` (verbatim fds.md/behavior.md copy).
- `"Cancel"`: closes with no changes (behavior.md §4 step 3).
- `"Delete"`: pending state on the button while in flight; on success the dialog closes, the row is removed (refetched ledger), pagination/`total` recalculate from the refetched response, and a confirmation toast is shown. **Exact toast copy is not specified** — proposed: `"Transaction deleted successfully!"`, flagged in §9.
- On failure: dialog stays open with an inline `FormAlert`; no copy specified — proposed generic: `"Couldn't delete the transaction. Please try again."`

### Filters, sort, and pagination

- Four selects in the toolbar row: Timeframe (default `"This Month"`), Category (default `"All Category"`), Type (default `"All Types"`), Sort (default `"Newest First"`, other option `"Oldest First"`) — matching behavior.md §1's stated defaults.
- Changing **any** filter or the sort re-queries (`useTransactions` with the new filter set) and resets `page` back to `1` (behavior.md §1).
- Pagination: `"Prev"` / numbered pages / `"Next"`, driven by `total` and the fixed page `limit` (proposed default `10` per page to match the visual's 9 visible rows plus 3 page buttons — not specified in fds.md; flagged in §9 as a frontend-only assumption to build mocks against).

## 5. What the Frontend Needs From the Backend (plain-language intents, not a formal contract)

1. **List transactions (ledger page load + every filter/sort/page change)** — needs to read a page of transactions for the current authenticated user, filtered by an optional `category` (one of the 10 enum values), an optional `type` (`income`/`expense`), a `timeframe` value, sorted `newest`/`oldest` by date, and paginated by `page`/`limit`. Needs back the page of `Transaction` records (all 8 data-model fields) plus a `total` count across the full filtered set (used to compute the number of pages for the Prev/Next/numbered controls). **Needs the backend to confirm the exact set of `timeframe` values** fds.md declares the query param but never enumerates its allowed values beyond the single default shown in the visual (`"This Month"`) — this fragment builds against a proposed `today` / `this_week` / `this_month` / `this_year` / `all_time` set (§3, §9) and needs the Synthesizer/backend to pin down the real one. Also needs a default/expected `limit` value confirmed (frontend proposes `10`, §4, §9).
2. **Create transaction** — needs to write `date`, `description`, `category`, `type`, `amount` (always a positive number; `type` carries the sign) for the current user and get back the created `Transaction` (or enough of it — at minimum its generated `id`) so the UI can reflect it without blind-refetching if that's preferred; this fragment refetches the list regardless (§3), so the minimum need is just a clear success/failure signal, with field-level validation failures returned in a shape the frontend can map back onto the Date/Description/Category/Type/Amount fields (mirroring the field-errors pattern already used by `profile`'s `updateProfile`).
3. **Update transaction** — needs to write the same five fields for an existing `id` and get back confirmation (ideally the updated `Transaction`) plus the same field-level validation failure shape as create.
4. **Delete transaction** — needs to write a delete-by-`id` request and get back a success acknowledgment (fds.md §5 shows `success: true, id: string`) or a failure, so the row/pagination/`total` can be recalculated from a refetch.
5. **General**: every one of the above is a protected (authenticated) operation, consistent with `transactions` depending on `auth`. No endpoint needs anything from `profile` directly — the frontend already has the signed-in user's `preferredCurrency` from the existing `useProfile()` query and does not need the transactions API to also return it.

## 6. Empty / Loading / Error States

- **Initial list load**: table area shows a lightweight skeleton/placeholder (no spec-mandated copy or visual — proposed: a few pulse/skeleton rows matching the table's row height), consistent with `ProfilePageSkeleton`'s existing pattern.
- **Load failure**: page-level error state with a retry action (no copy specified — proposed, matching `ProfilePageError`'s existing exact wording style: `"Couldn't load your transactions. Please try again."`).
- **Empty result set** (filters/timeframe produce zero rows): a single centered row/message in place of the table body — no copy specified, proposed: `"No transactions found for the selected filters."` Not addressed anywhere in fds.md/behavior.md/visuals (the mockup only shows a populated table); flagged in §9.
- **Add/Edit dialogs**: idle → pending (`isLoading` on the submit `Button`, inputs remain editable, same as `EditProfileDialog`) → success (close + toast + refetch) → failure (inline `FieldError`s for field-level failures, or a `FormAlert`/toast for a generic failure; dialog stays open, inputs preserved).
- **Delete dialog**: idle → confirmation open → pending (`"Delete"` button `isLoading`, `"Cancel"` disabled) → success (dialog closes, toast, row removed) → failure (dialog stays open, inline `FormAlert`, retry-able).
- **Filter/sort changes**: the table area shows the same loading skeleton while the new query is in flight (brief re-query, not a full page reload).

## 7. Component & End-to-End Test Requirements (implied by `behavior.md`)

### Component/unit tests (Vitest + Testing Library, mirroring `frontend/src/features/profile/components/*.test.tsx` conventions — `renderWithProviders`, `vi.mock` of the feature's `api` module)

- `transactions-page.test.tsx`: renders loading skeleton, then the toolbar/filters/table/pagination once `useTransactions` resolves; renders the page-level error/retry state on query failure; renders the empty-state message when `data` is empty.
- `transaction-filters.test.tsx`: each select defaults to its specified placeholder/value; changing any one of the four triggers a re-query with the new value and resets `page` to `1` (behavior.md §1 — directly tested, e.g. by asserting the query is re-issued with `page: 1` even when a later page was previously selected).
- `transactions-table.test.tsx` / `transaction-row.test.tsx`: renders Date/Category (icon + label)/Description/Amount/Type badge/Actions for each row, with amount formatted per §4 (sign + currency symbol derived from `type` + the mocked `preferredCurrency`).
- `add-transaction-dialog.test.tsx`: all five fields render with their specified placeholders; submitting with any required field empty or `amount <= 0` shows inline errors without submitting (behavior.md §2, acceptance criteria); success path shows the exact toast copy `"Transaction added successfully!"`, closes the dialog, and triggers a list refetch; failure path shows the exact toast copy `"Failed to add transaction. Please try again."` and preserves all entered field values; Cancel/backdrop-click discards input.
- `edit-transaction-dialog.test.tsx`: all fields pre-fill from the given `Transaction`; same validation coverage as Add; success/failure paths per §4 (noting the proposed, not-FDS-literal, toast copy); Cancel discards changes.
- `delete-transaction-dialog.test.tsx`: renders the exact title and body copy; Cancel makes no changes; Delete (success) removes the row and shows a confirmation toast; Delete (failure) keeps the dialog open with an inline alert.
- `pagination-controls.test.tsx`: `"Prev"` disabled on page 1, `"Next"` disabled on the last page, clicking a page number re-queries that page.

### End-to-end tests (Playwright, new `e2e/transactions-*.spec.ts` files, following the existing `e2e/profile-*.spec.ts` + `e2e/support/auth.ts` session-bootstrap pattern)

- `e2e/transactions-view-and-filter.spec.ts`: signed-in user navigates to `/transactions` (direct URL, no shared nav yet per §1), sees the default-filtered ("This Month" / "All Category" / "All Types" / "Newest First") ledger, changes each filter/sort and sees the table and pagination update, with pagination reset to page 1 on every change.
- `e2e/transactions-add.spec.ts`: full add-transaction happy path ending in the exact success toast and the new row visible in the ledger (under the default Newest-First sort); validation-error path (empty fields / non-positive amount) shows inline errors without submitting; simulated failure path shows the exact error toast and preserves entered values.
- `e2e/transactions-edit.spec.ts`: opens the edit dialog from an existing row, confirms pre-filled values, edits and saves, confirms the row updates in place.
- `e2e/transactions-delete.spec.ts`: opens the delete confirmation, cancels (no change), then confirms deletion and confirms the row is gone and pagination/page count reflect the new total.
- `e2e/transactions-pagination.spec.ts`: navigates across pages via numbered buttons and Prev/Next, confirming row content changes and boundary buttons disable correctly.

## 8. Shared UI Additions Needed (flagged for Synthesizer/Build Mode awareness)

Not new libraries — small additions to existing `components/ui/` and `components/ui/icons.tsx`, continuing the precedent set by `profile`'s fragment (which added the `secondary`/`destructive` `Button` variants and `Checkbox`, both since built and now present in the codebase):

- A native `<select>`-based `SelectField` presentational component under `components/ui/` (no `@radix-ui/react-select`, which is not installed/approved) — needed for the four filter dropdowns and the Category/Type fields in the Add/Edit forms; none of the existing primitives (`IconInput`, `Checkbox`) cover a dropdown-with-options control.
- New icons in `components/ui/icons.tsx`: `CalendarIcon`, `ChevronDownIcon` (date field + all select-style dropdowns), `EditIcon` (pencil, yellow row action), `TrashIcon` (red row action). Ten small category glyphs (§2) could either live alongside these or as a dedicated, more decorative icon set under `features/transactions/components/category-icon.tsx` — left to Build Mode's judgment since it's a purely presentational detail with no behavioral implication.
- **Toast icon gap** (not introduced by this fragment, but newly relevant here): `fds.md §4` and the visual (`transaction-toast-success.png`/`transaction-toast-error.png`) both show a checkmark/alert-circle icon inside the toast banner, but the existing shared `components/ui/toast.tsx` (already built for `auth`/`profile`) renders text-only banners with no icon slot. This fragment's toasts reuse the existing `useToast().success(...)`/`.error(...)` API exactly as-is (text only, no icon), consistent with how `profile`'s toasts already ship. Closing this icon gap, if desired, is a shared-component change outside any single feature's scope — flagged here, not fixed here.

## 9. Ambiguities Considered and Resolved (not blocking)

Evaluated and resolved within this fragment rather than escalated, per the same bounded-resolution approach `profile`'s fragment used:

- **"Recalculates totals and pagination" (fds.md REQ-TXN-03) / "Summary statistics... recalculate automatically" (behavior.md §4)**: resolved as referring to the already-specified `total: number` field in `getTransactions`'s response (fds.md §5), which drives the pagination control — not a separate on-page summary/stats card. No summary-stats widget appears anywhere in `transactions-page.png`, and no FDS requirement (REQ-TXN-01 through 04) describes one, so this fragment does not build one.
- **Amount field's `-₹450` display (behavior.md §3, `transaction-edit-modal.png`)**: resolved as a display-only prefix (sign derived from `type`, currency symbol from the signed-in user's `preferredCurrency`) layered over a plain positive-number form value, not literal editable text content — because the data model (fds.md §2) defines `amount` as always-positive with `type` carrying direction separately, and requiring a user to type a currency symbol into a numeric field would conflict with that model.
- **"Added to the top of the table" (behavior.md §2 step 3, Add success)**: resolved as this fragment refetching the ledger with the current filters/sort/page (satisfying fds.md REQ-TXN-01's "refreshes the ledger view") rather than literally always inserting at row 0 — because "always at top" only holds under the default Newest-First sort and would contradict an Oldest-First sort, which the spec also supports.
- **`timeframe` filter's allowed values**: fds.md §5 declares the query param but never enumerates it; the visual only ever shows the closed dropdown at its default (`"This Month"`). This fragment proposes `today` / `this_week` / `this_month` / `this_year` / `all_time` to build mocks against (§3) and lists the gap explicitly in §5 as something the Synthesizer/backend needs to confirm, rather than treating it as blocking — it's a enumerable-value gap, not a contradiction, and doesn't change any other part of this fragment's shape.
- **Date field's literal `"Title"` placeholder (fds.md REQ-TXN-01 item 1)**: taken at face value since it's stated identically in the FDS text and shown identically in the visual mockup (no contradiction between the two) — flagged in §4 only as an implementation note (native date inputs don't fully support custom placeholder text), not as a spec ambiguity.
- **Default page size (`limit`)**: not specified anywhere; this fragment proposes `10` to build mocks/pagination UI against (§4), listed as an open item for the backend to confirm in §5.
- **Edit success/failure toast copy and Delete success/failure copy**: fds.md §4 and behavior.md only give verbatim copy for Add's two toasts. This fragment proposes consistent, generically-worded copy for Edit and Delete (§4) and flags every instance as not literally specified, rather than treating the gap as blocking, since the FDS and behavior.md both confirm _that_ a toast occurs for these actions — only the exact wording is open.
- **Empty-result-set copy**: not specified anywhere (the visual only shows a populated table); this fragment proposes placeholder copy (§6), flagged as non-literal.
