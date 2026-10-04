# Frontend Fragment: `transactions` v1.1.0

> **SUPERSEDED.** Stale after revision 5. Kept as an audit trail only; do not use as synthesis input. The authoritative sources are `../plan.md` and `../contract.md`.

**Author**: Frontend Plan Fragment subagent (Phase 1, `Phase = Both`, fresh run; no `v1.1.0/directives.md` exists)
**Inputs read**: `features/transactions/fds.md` (v1.1.0, incl. changelog), `features/transactions/behavior.md`, `features/transactions/visuals/*.png` (all six), `rules/architecture.md`, `rules/conventions.md`, `rules/tech-stack.md`, `features/index.json`, the frozen `v1.0.0/plan.md` (its Decision Log, for decisions this version carries forward), the superseded `v1.0.0/fragments/frontend.md`, and the built `frontend/src/features/transactions/**` tree from plan v1.0.0.
**Not read**: any backend fragment, from any version.
**Scope**: Frontend and Frontend-Testing only. No backend, integration, or formal API contract content. The Plan Synthesizer reconciles this with the independently drafted Backend Fragment.

---

## 0. What Changed and How This Fragment Is Organized

FDS 1.1.0 changelog: a required `title` field is added; the Add/Edit modals' first control becomes a **Title** text input in place of the date picker; `date` is no longer user-entered (the server sets it to the creation date and never changes it on update); the ledger table gains a **Title** column.

**Spec consistency check (done before drafting, as instructed).** `behavior.md` and `visuals/` agree with FDS 1.1.0 on every point the change touches:

| Point                    | `fds.md` 1.1.0                                                                 | `behavior.md`                                                       | `visuals/`                                                                                             |
| :----------------------- | :----------------------------------------------------------------------------- | :------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------- |
| Add modal first control  | Title text input, placeholder `"Title"`, no date control (REQ-TXN-01 item 1)   | Title input, placeholder `Title`, "There is no date picker" (§2.2)  | `transaction-add-modal.png`: full-width plain text input reading `Title`, no calendar icon, no chevron |
| Edit modal first control | Title pre-filled (`Dinner out`); date shown nowhere, not editable (REQ-TXN-02) | Title pre-filled (`Dinner out`); date not shown (§3.2)              | `transaction-edit-modal.png`: first input reads `Dinner out`; no date anywhere                         |
| Date of a new record     | Set by the server to the creation day (§2, §5 `createTransaction`)             | "dated today when it is saved"; new record "(dated today)" (§2.2–3) | n/a                                                                                                    |
| Ledger columns           | Date, Category, Title, Description, Amount, Type badge, Actions (REQ-TXN-04)   | n/a                                                                 | `transactions-page.png`: exactly those seven, in that order                                            |
| Date on update           | Unchanged (§2, §5 `updateTransaction`, §6)                                     | "cannot be changed" (§3.2)                                          | n/a                                                                                                    |

No contradiction affecting this fragment was found, so this fragment does not stop. The non-blocking items it resolves are in §9.

This fragment is drafted against the **full** FDS 1.1.0. Because plan v1.0.0 is already built and integrated, each section marks what the existing code already satisfies (**[exists]**), what changes (**[change]**), and what is new (**[new]**), so the Synthesizer can turn it into a small delta task list without re-deciding anything that v1.0.0 already settled.

---

## 1. Route & Page Structure [exists]

- Route `frontend/src/app/(protected)/transactions/page.tsx` inside the `(protected)` group, rendering `TransactionsPage`. Unchanged.
- Page composition per `transactions-page.png`: heading `"Transactions"`, right-aligned `"+ Add Transaction"` button, the four-select toolbar (Timeframe / Category / Type / Sort), the ledger table, then pagination. Unchanged except for the table's new Title column (§2).
- The visual's app shell (FinTrack logo, top nav, header icons, footer) is still not built by this feature. This carries v1.0.0's **D-11** forward unchanged; FDS 1.1.0 adds no requirement touching it.

---

## 2. Component Breakdown

All paths under `frontend/src/features/transactions/` unless stated.

| Component / module                                           | Status       | v1.1.0 responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| :----------------------------------------------------------- | :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `components/transactions-page.tsx`                           | [exists]     | Owns filter/page state, loading/error/empty states, and which dialog is open. No change.                                                                                                                                                                                                                                                                                                                                                                                                                |
| `components/transactions-toolbar.tsx`                        | [exists]     | Heading + `"+ Add Transaction"` + filters. No change.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `components/transaction-filters.tsx`                         | [exists]     | Timeframe (`This Week` / `This Month` / `This Year` / `All Time`, default `This Month`), Category (`All Category`), Type (`All Types`), Sort (`Newest First` / `Oldest First`). Any change resets page to 1. No change.                                                                                                                                                                                                                                                                                 |
| `components/transactions-table.tsx`                          | **[change]** | Header becomes `Date, Category, Title, Description, Amount, Type, Actions` (insert `"Title"` between `"Category"` and `"Description"`, matching `transactions-page.png`). The empty-state row's `colSpan` follows the header count automatically (it already uses `COLUMN_HEADERS.length`), so it becomes 7.                                                                                                                                                                                            |
| `components/transaction-row.tsx`                             | **[change]** | Render a `title` cell between the category cell and the description cell. The Edit/Delete buttons' accessible names switch from the description to the title (`"Edit <title>"`, `"Delete <title>"`), since the title is now the record's short name (FDS §2: "Short name of the transaction"). Date, amount, and badge rendering are unchanged.                                                                                                                                                         |
| `components/transaction-form-fields.tsx`                     | **[change]** | First control becomes a plain **Title** text input (placeholder `"Title"`, visually hidden label `"Title"`, `FieldError` below it), styled like the Description input and full width per the visuals. The date input is removed together with its calendar icon, trailing chevron, `"Title"` overlay `<span>`, and the `text-transparent` workaround. The `dateValue` prop is removed. Description, Category, Type, Amount are unchanged.                                                               |
| `components/add-transaction-dialog.tsx`                      | **[change]** | Default values become `{ title: "", description: "", category: "", type: "", amount: "" }` (no `date`). Drop the `watch("date")` call and the `dateValue` prop. Submits `{ title, description, category, type, amount }`. Copy, toasts, and close/preserve behavior unchanged.                                                                                                                                                                                                                          |
| `components/edit-transaction-dialog.tsx`                     | **[change]** | Pre-fills `title` from the record instead of `date`. Drop `watch("date")`/`dateValue`. Submits `{ title, description, category, type, amount }` for the record's `id`; never sends a date. Copy, toasts, and close/preserve behavior unchanged.                                                                                                                                                                                                                                                         |
| `components/delete-transaction-dialog.tsx`                   | [exists]     | Unchanged. (It does not display the title, the date, or any other record field; the visual shows only the fixed title and body copy.)                                                                                                                                                                                                                                                                                                                                                                   |
| `components/pagination-controls.tsx`                         | [exists]     | Unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `components/category-icon.tsx`, `transaction-type-badge.tsx` | [exists]     | Unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `lib/transaction-form-schemas.ts`                            | **[change]** | Replace `transactionDateSchema` (and the now-unused `isValidCalendarDate` helper) with `transactionTitleSchema`: required, 1–100 characters (FDS §2). `transactionFormSchema` becomes `{ title, description, category, type, amount }`. Messages must mirror whatever the formal contract settles (as the existing schemas already mirror v1.0.0 `contract.md` §4); proposed: `"Title is required."` / `"Title must be at most 100 characters."`, trimmed before the length check, same as Description. |
| `lib/transaction-error.ts`                                   | **[change]** | `OPERATION_FORM_FIELDS.createTransaction` and `.updateTransaction` become `["title", "description", "category", "type", "amount"]` (drop `"date"`, add `"title"`), so a server field error on `title` counts as displayable and one on `date` no longer does.                                                                                                                                                                                                                                           |
| `api/transactions-api.ts`                                    | **[change]** | The request types `CreateTransactionRequest` / `UpdateTransactionRequest` currently `Pick<Transaction, "date" \| …>`; they must carry `title` and **not** `date`. Function signatures and the `runOperation` pattern are otherwise unchanged. See §5.6 for the sequencing constraint this creates.                                                                                                                                                                                                      |
| `hooks/*`                                                    | [exists]     | `useTransactions`, `useCreateTransaction`, `useUpdateTransaction`, `useDeleteTransaction` unchanged in shape; each mutation still invalidates `["transactions"]` on success.                                                                                                                                                                                                                                                                                                                            |
| `frontend/src/components/ui/icons.tsx`                       | **[change]** | `CalendarIcon` loses its only consumer (the removed date field; confirmed no other reference in `frontend/src` or `e2e`). Proposed: remove it rather than leave dead code for the SonarQube gate. `ChevronDownIcon` stays (used by `SelectField`).                                                                                                                                                                                                                                                      |

No new library and no new shared UI primitive is needed.

---

## 3. Mock Data Shapes

The v1.0.0 mock fixture was deleted at Integration (v1.0.0 INT-02), and the API module now talks to the real ts-rest client. Any mock built for this version (a temporary fixture during Frontend Build, and the `vi.mock` data in component tests) uses this shape, matching FDS 1.1.0 §2 exactly:

```ts
interface MockTransaction {
  id: string; // UUID
  title: string; // 1–100 chars, e.g. "Dinner out"
  date: string; // "YYYY-MM-DD"; read-only on the client, set by the server at creation
  description: string; // 1–255 chars, e.g. "Dinner at Café Coffee Day"
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
  amount: number; // always positive; `type` carries the direction
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

// What the Add and Edit forms submit. Note: no `date`.
interface MockTransactionWriteInput {
  title: string;
  description: string;
  category: MockTransaction["category"];
  type: MockTransaction["type"];
  amount: number;
}

interface MockTransactionListQuery {
  page: number;
  limit: number; // 10 (v1.0.0 D-08)
  category?: MockTransaction["category"]; // absent = "All Category"
  type?: MockTransaction["type"]; // absent = "All Types"
  timeframe: "this_week" | "this_month" | "this_year" | "all_time"; // default "this_month" (v1.0.0 D-05)
  sort: "newest" | "oldest";
}

interface MockTransactionListResult {
  data: MockTransaction[];
  total: number;
}
```

Sample fixture rows should mirror the visuals: e.g. `{ title: "Dinner out", description: "Dinner at Café Coffee Day", category: "food_and_dining", type: "expense", amount: 450 }`, plus one row per category so the Title column and every category icon are exercised. A mock `createTransaction` sets `date` to the current local `YYYY-MM-DD` and ignores any client-supplied date; a mock `updateTransaction` leaves `date` untouched. Both model the FDS 1.1.0 server behavior for UI-review purposes only. The frontend never computes the authoritative date.

---

## 4. Forms, Validation UX, and Interaction Details

### Shared form fields (Add and Edit)

Per REQ-TXN-01/02, `behavior.md` §2–§3, `transaction-add-modal.png`, `transaction-edit-modal.png`, top to bottom:

1. **Title** [new]: plain text input, placeholder `"Title"`, required, 1–100 characters (FDS §2). Inline `FieldError` on submit/change, same as Description. No icon, no chevron (the visual shows a plain input). This placeholder is now a real `placeholder` attribute, which removes v1.0.0's "approximate `Title` over a native date input" workaround entirely.
2. **Description** [exists]: placeholder `"Enter Description"`, required, 1–255.
3. **Category** [exists]: `SelectField`, placeholder option `"All Category"`, 10 labelled options; the placeholder does not submit.
4. **Type** [exists]: `SelectField`, placeholder option `"All Types"`, `Income`/`Expense`; the placeholder does not submit.
5. **Amount** [exists]: placeholder `"Amount"`, required, `> 0`.

There is **no date control** in either dialog, and the Edit dialog does not display the date anywhere, even read-only (REQ-TXN-02: "The date is shown nowhere in this modal").

Client validation stays React Hook Form + Zod (`mode: "onSubmit"`, `reValidateMode: "onChange"`). It is the instant-feedback layer only; the server is authoritative (`rules/architecture.md` Validation). Submitting with any required field empty (now including Title), Title over 100 characters, or `amount <= 0` shows inline errors and sends nothing (FDS §6, `behavior.md` §2.3).

If a submission comes back as a `field-errors` failure, the existing behavior applies unchanged: the dialog shows the operation's failure toast and keeps the entered values. Mapping server `fieldErrors` onto individual inputs is not required by the FDS and is not added here.

### Add Transaction dialog

- Opens from `"+ Add Transaction"` with all five fields empty/at placeholder.
- `"Add"` success: dialog closes, green toast `"Transaction added successfully!"` (exact FDS §4 copy), the ledger refetches. Under the default view (`This Month` + `Newest First`), the new record (dated today by the server) lands at the top of page 1 (`behavior.md` §2.3), given the v1.0.0 D-07 same-date tie-break `createdAt DESC`.
- `"Add"` failure: red toast `"Failed to add transaction. Please try again."` (exact copy), dialog stays open, all five values preserved.
- `"Cancel"`, backdrop click, or close icon: closes immediately, input discarded.

### Edit Transaction dialog

- Opens from a row's yellow pencil, pre-filled with that record's title, description, category, type, and amount.
- `"Save"` success: closes, row updates through the refetch, toast `"Transaction updated successfully!"` (v1.0.0 D-12, carried forward). The row's Date cell is unchanged after the save.
- `"Save"` failure: toast `"Failed to update transaction. Please try again."` (D-12), dialog stays open, values preserved.
- `"Cancel"`: closes, changes discarded.

### Delete confirmation [exists, unchanged]

Title `"Delete Transaction?"`, body `"Are you sure you want to delete this transaction? This action cannot be undone."`, outlined `"Cancel"`, solid red `"Delete"`. Success: closes, row removed, total and pagination recalculated from the refetch, toast `"Transaction deleted successfully!"` (D-12). Failure: stays open with an inline alert (D-12 copy).

### Filters, sort, pagination [exists, unchanged]

Defaults `This Month` / `All Category` / `All Types` / `Newest First`; any change re-queries and resets to page 1 (`behavior.md` §1). Prev / numbered / Next, with boundary buttons disabled.

---

## 5. What the Frontend Needs From the Backend (plain-language intents, not a formal contract)

1. **List transactions** (page load and every filter/sort/page change). Reads a page of the signed-in user's transactions filtered by optional category, optional type, the timeframe preset, sorted newest/oldest by date, paginated by page/limit. **Needs each returned record to include `title`** alongside every other FDS §2 field, plus `total` for the filtered set. Every record shown in the ledger must have a non-empty `title`, since the Title column and the Edit pre-fill depend on it (see §5.5). Filter inputs are otherwise unchanged from v1.0.0.
2. **Create a transaction.** Writes `title`, `description`, `category`, `type`, `amount`. **The frontend sends no date.** Needs the server to stamp `date` as today (FDS §2), and needs back a clear success/failure signal (ideally the created record, including the server-assigned `date`), with field-level validation failures keyed by the same field names the form uses, now including `title`.
3. **Update a transaction** by `id`. Writes the same five fields, `title` included, and **no date**. Needs the record's `date` left unchanged (FDS §2, §5, §6), and the same success/field-error signal as create.
4. **Delete a transaction** by `id`. Unchanged from v1.0.0: a success acknowledgment or a failure.
5. **Records created before v1.1.0.** Rows created under v1.0.0 have no title today. The frontend needs every record it receives to carry a `title` string that satisfies the 1–100 rule, so legacy rows render a title cell and their Edit dialog opens pre-filled with a valid value. How those rows get a title is not a frontend decision; this fragment only states the need so the Synthesizer can match it with whatever the backend proposes.
6. **Shared type sequencing.** The frontend's request and record types come from `@workflow-demo/contracts` (v1.0.0 Integration). The Frontend Build may not touch `packages/contracts/` (CLAUDE.md path boundaries), so the frontend changes in §2 cannot type-check against a `Transaction` that has `title` and a write body without `date` until the contracts package carries them. The Synthesizer needs to pick one of: (a) run the contracts change before or alongside the Frontend Build so the frontend compiles against it; or (b) have the Frontend Build use temporary local types and a mock-backed `transactions-api.ts` (the v1.0.0 Phase 5 pattern), switched back to the contract types at Integration. This fragment works under either; it does not prescribe the contract itself.
7. **General.** Every operation stays authenticated. Nothing new is needed from `profile`; the currency symbol still comes from `useProfile().preferredCurrency` (v1.0.0 D-04).

---

## 6. Empty / Loading / Error States [exists, unchanged]

- Initial load and filter changes: skeleton (`aria-busy`, "Loading transactions").
- Load failure: `"Couldn't load your transactions. Please try again."` + Retry (v1.0.0 D-14).
- Empty result set: one full-width row, `"No transactions found for the selected filters."` (D-13), now spanning 7 columns.
- Add/Edit: idle → pending (submit button `isLoading`) → success (close + toast + refetch) or failure (toast, dialog open, values kept).
- Delete: idle → pending → success (close + toast + refetch) or failure (inline alert, dialog open).

---

## 7. Component & End-to-End Test Requirements

No frontend tests for `transactions` exist yet (v1.0.0 Phase 8 has not run; `frontend/src/features/transactions/**` has no `*.test.tsx`, and `e2e/` has no `transactions-*.spec.ts`). The full set below is therefore needed. It is the v1.0.0 T-UI-01…12 set updated for FDS 1.1.0. Items marked **(1.1.0)** test the change directly.

### Component tests (Vitest + Testing Library; `renderWithProviders`; `vi.mock` of `api/transactions-api.ts`, following `features/profile/components/*.test.tsx`)

- **`transactions-page.test.tsx`**: skeleton, then toolbar/filters/table/pagination; D-14 error + Retry on failure; D-13 empty state on an empty `data`.
- **`transaction-filters.test.tsx`**: defaults `This Month` / `All Category` / `All Types` / `Newest First`; Timeframe has exactly 4 options, with no `Today`; each change re-queries with the new value and `page: 1`, even from a later page (`behavior.md` §1).
- **`transactions-table.test.tsx` / `transaction-row.test.tsx` / `transaction-type-badge.test.tsx`**:
  - **(1.1.0)** Header cells are exactly `Date, Category, Title, Description, Amount, Type, Actions`, in that order.
  - **(1.1.0)** Each row renders its `title` in the Title column, distinct from its description.
  - Date formatted (`15 Oct 2025` style), category icon + label, signed amount with the profile's currency symbol, Income/Expense badge.
  - **(1.1.0)** The Edit/Delete buttons are named by the title (`Edit Dinner out`, `Delete Dinner out`).
  - **(1.1.0)** The empty-state cell spans all 7 columns.
- **`add-transaction-dialog.test.tsx`**:
  - **(1.1.0)** The first field is a text input with placeholder `Title`. The dialog contains no date input (`input[type="date"]` absent) and no control labelled "Date".
  - All five placeholders render: `Title`, `Enter Description`, `All Category`, `All Types`, `Amount`.
  - **(1.1.0)** Submitting with an empty Title, or a 101-character Title, shows an inline Title error and calls nothing. A 100-character Title is accepted.
  - Empty Description/Category/Type/Amount and `amount <= 0` each show inline errors without submitting.
  - **(1.1.0)** On a valid submit, the API is called with exactly `{ title, description, category, type, amount }`, with **no `date` key**.
  - Success: exact toast `Transaction added successfully!`, dialog closes, list invalidated.
  - Failure: exact toast `Failed to add transaction. Please try again.`, all five values preserved.
  - Cancel and backdrop click discard input; reopening shows empty fields.
- **`edit-transaction-dialog.test.tsx`**:
  - **(1.1.0)** Pre-fills Title (`Dinner out`), Description, Category, Type, Amount from the record.
  - **(1.1.0)** The dialog shows the record's date nowhere: no date input, and the formatted date string does not appear in the dialog.
  - Same validation coverage as Add, Title included.
  - **(1.1.0)** Save calls the API with the record's `id` and a body of exactly `{ title, description, category, type, amount }`, with **no `date` key**, including when only the title was changed.
  - Success and failure toasts use D-12 copy; failure preserves the edits; Cancel discards.
- **`delete-transaction-dialog.test.tsx`**: exact title and body copy; Cancel makes no call; Delete success shows the toast and closes; Delete failure keeps the dialog open with the inline alert.
- **`pagination-controls.test.tsx`**: Prev disabled on page 1, Next disabled on the last page, clicking a number requests that page.
- **`transaction-form-schemas.test.ts`** (1.1.0): the Title rule accepts 1 and 100 characters; it rejects empty, whitespace-only, and 101 characters with the agreed messages. The form schema has no `date` key.
- **`transaction-error.test.ts`** (1.1.0): a `VALIDATION_ERROR` whose `fieldErrors` contains only `title` maps to `field-errors` for create/update. One containing only `date` maps to `unexpected`.

### End-to-end tests (Playwright; `e2e/transactions-*.spec.ts`; sign in through `e2e/support/auth.ts`; reach `/transactions` by direct URL per D-11)

- **`transactions-view-and-filter.spec.ts`**: default filters shown; **(1.1.0)** the table header includes `Title` between `Category` and `Description`; each filter/sort change updates the table and resets to page 1.
- **`transactions-add.spec.ts`**:
  - **(1.1.0)** The Add dialog shows a `Title` input and no date picker.
  - Fill Title/Description/Category/Type/Amount and submit, then expect the exact success toast. **(1.1.0)** The new row appears at the top of the default view with its Title and **today's date** in the Date column (FDS §6). Compute "today" in the same timezone the server uses, so the assertion cannot flake across midnight.
  - Validation path: empty fields (Title included) and `amount <= 0` show inline errors and no request is sent.
  - Failure path (route the create request to an error response): exact error toast, values preserved.
- **`transactions-edit.spec.ts`**:
  - Open Edit on a seeded row; it is pre-filled, Title included. **(1.1.0)** No date is visible in the dialog.
  - Change the Title (and another field), then Save: the row updates in place with the new Title. **(1.1.0)** The row's Date cell is identical before and after (FDS §6: "the transaction's date is not editable and stays unchanged").
- **`transactions-delete.spec.ts`**: Cancel leaves the row; Delete removes it, and the total and page count reflect the new total.
- **`transactions-pagination.spec.ts`**: numbered buttons and Prev/Next move between pages; boundary buttons disable.

Seeding for E2E creates records through the UI or the API as signed-in users. Since `date` is now server-set to "today", data that must fall on different days or outside `This Month` (filter/sort/pagination specs) cannot be produced through the create operation alone. The E2E specs need a way to seed dated rows; that need is noted for the Synthesizer in §9.

---

## 8. Visual Conformance Notes for Phase 6 UI Review

- Add modal: Title input is full width and sits first. Description/Category/Type/Amount and the Cancel/Add buttons look as in v1.0.0. No calendar icon or chevron on the first field.
- Edit modal: first input shows `Dinner out`; no date anywhere.
- Ledger: seven columns in the visual's order, with Title as plain text (no icon).
- Because the v1.0.0 UI is already frozen, Phase 6 for this version only needs to review these three deltas.

---

## 9. Ambiguities Considered and Resolved (not blocking)

- **Edit amount display, `450` (FDS REQ-TXN-02) vs `-₹450` (`behavior.md` §3, `transaction-edit-modal.png`).** This predates 1.1.0 and was settled by v1.0.0 **D-03**: the stored and submitted amount is always positive, and `-₹` is display-only. Observation: the built Edit dialog shows a plain `450` with no `-₹` adornment. That satisfies the FDS literal and was accepted at the v1.0.0 UI freeze, but it does not match D-03's described prefix or the visual. This fragment leaves that field as built (the 1.1.0 change does not touch it). **★ for the Synthesizer/developer:** either keep it as frozen, or add the display-only `-₹` prefix as a small extra task. Either way the submitted value stays a plain positive number.
- **Title whitespace and length messages.** FDS §2 gives only "1–100 characters". This fragment proposes trimming before the length check (the same treatment Description already gets) and the messages in §2. The exact messages must match the formal contract's rule set.
- **Row action accessible names.** The current names use the description. Switching to the title is a presentation-only improvement now that a short name exists; it is not an FDS requirement and can be dropped if the Synthesizer prefers a zero-delta row.
- **"Added to the top of the table" (`behavior.md` §2.3).** This holds under the default view because the new record is dated today and ties on date are broken by `createdAt DESC` (v1.0.0 D-07). Under `Oldest First`, or a timeframe that excludes today, the ledger refetch shows the record where the current view puts it. This is the same reasoning as v1.0.0 §9 and is unchanged.
- **E2E seeding of past-dated rows.** With the date no longer client-supplied, filter/sort/pagination E2E specs cannot create rows on other dates through the public create operation. This needs an E2E-only seeding route that does not touch production behavior (for example, direct inserts into the E2E database, or a test clock). That is a test-infrastructure decision for the Synthesizer, not a spec ambiguity.
- **Carried forward unchanged from v1.0.0:** D-03 (positive amount, `type` carries the sign), D-04 (shared `CURRENCY_SYMBOLS`), D-05 (4-value timeframe), D-07 (same-date tie-break), D-08 (`limit` 10), D-11 (no app shell), D-12 (Edit/Delete toast copy), D-13 (empty-state copy), D-14 (load-failure copy).
