# Backend Fragment — `transactions` v1.0.0

> **SUPERSEDED.** Stale after revision 1. Kept as an audit trail only; do not use as synthesis input. The authoritative sources are `../plan.md` and `../contract.md`.

Scope: Backend + Backend-Testing only (data model, repository, service, validation rules, route
intents as plain field/rule lists, and unit/API test requirements). No formal API contract, no
Frontend, no Integration content. A separate Frontend Fragment is being drafted independently;
this fragment does not assume or depend on its contents.

## 0. Prior Stop, Now Resolved

A previous Backend Fragment attempt for this version stopped (see `../activity-log.md`) because
`fds.md`'s `timeframe` filter had no defined value set and conflicted with the §6 "date range"
wording. `fds.md` has since been updated (frontmatter changelog, version still `1.0.0`) with an
explicit addendum in `REQ-TXN-04` and `§5`: `timeframe` is a closed enum —
`"this_week" | "this_month" | "this_year" | "all_time"` — defaulting to `"this_month"`, and the §6
wording describes this preset's effect, not a separate `startDate`/`endDate` input. This fragment
proceeds on that basis.

## 1. Cross-Feature Integration with `auth`

`features/index.json` declares `transactions` depends on `auth` (and `profile`, which this
fragment does not need — `transactions` has no relationship to profile preferences/currency
formatting at the data layer; currency symbol display is a frontend concern per `fds.md` §2). Every
transaction belongs to exactly one user:

- `transactions.user_id` is a required FK to `users.id` (cascade delete), same pattern as
  `user_profiles.user_id` in `backend/src/db/schema/profile.ts`.
- All reads/writes are scoped by the authenticated user's id (`getAuthenticatedUserId(req)`,
  reusing the existing `backend/src/features/auth/require-auth.ts` middleware — no changes to
  `auth` files needed).
- A transaction id that exists but belongs to a different user is treated identically to a
  non-existent id (`404 NOT_FOUND`) — the repository's lookup methods take `(id, userId)` together
  so a cross-user id can never be read, updated, or deleted. This avoids leaking existence of other
  users' records and needs no new error code (resolved design decision, §8).

No existing `auth` or `profile` file is touched.

## 2. Data Model / Drizzle Schema Changes

New file `backend/src/db/schema/transactions.ts`, exported from
`backend/src/db/schema/index.ts` alongside the existing `auth` and `profile` exports.

### 2.1 `transactions` (one row per transaction, many per user)

| Column        | Type (Drizzle)                                | Notes                                                                                                                                                                                                 |
| :------------ | :-------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | `text` PK                                     | UUID generated in code, same convention as `users.id` / `user_profiles.id`                                                                                                                            |
| `user_id`     | `text` NOT NULL, FK → `users.id`, cascade     | Owner of the record; not part of the `Transaction` API shape (`fds.md` §2 lists no `userId` field, same as `profile`'s internal-only `user_id`)                                                       |
| `date`        | `text` NOT NULL                               | ISO date `YYYY-MM-DD` (`fds.md` §2); stored as plain text, no time component                                                                                                                          |
| `description` | `text` NOT NULL                               | 1–255 characters, enforced at Service/contract layer (SQLite has no native length CHECK worth adding here — see §8)                                                                                   |
| `category`    | `text` enum (10 values, `fds.md` §2) NOT NULL | Same enum-via-`text` pattern as `preferredCurrency`/`language` in `profile.ts` (TS-level enum safety, no DB CHECK)                                                                                    |
| `type`        | `text` enum (`"income"`,`"expense"`) NOT NULL |                                                                                                                                                                                                       |
| `amount`      | `real` NOT NULL                               | Always positive (`fds.md` §2); CHECK `amount > 0`, same hand-added-migration pattern as `user_profiles_monthly_start_date_check` in `profile.ts` (drizzle-kit 0.24 does not emit CHECK automatically) |
| `created_at`  | `text` ISO timestamp NOT NULL                 |                                                                                                                                                                                                       |
| `updated_at`  | `text` ISO timestamp NOT NULL                 |                                                                                                                                                                                                       |

Indexes:

- `transactions_user_id_idx` on `user_id` — every query is scoped by owner first.
- `transactions_user_id_date_idx` on `(user_id, date)` — supports timeframe filtering and
  date-based sort without a full table scan per user.

Migration: generated via the project's existing `drizzle-kit generate` flow as
`backend/src/db/migrations/0002_init_transactions.sql` (next sequential index after
`0000_init_auth` / `0001_init_profile`), with the `amount > 0` CHECK hand-added to the generated
SQL the same way `profile`'s migration hand-adds its CHECK.

## 3. Repository Layer

New file `backend/src/features/transactions/transaction-repository.ts`:

- `findById(id: string, userId: string): TransactionRecord | null` — scoped by both id and owner
  (§1); returns `null` if absent or owned by another user.
- `findManyByUserId(userId: string, filter: TransactionFilter): TransactionRecord[]` — applies
  `category`, `type`, and the resolved `[startDate, endDate)` window from `timeframe` (§5), then
  `ORDER BY date <asc|desc>, created_at <asc|desc>` (tie-break, §8), then `LIMIT`/`OFFSET` for the
  requested page.
- `countByUserId(userId: string, filter: TransactionFilter): number` — same filter predicate as
  `findManyByUserId`, without pagination, for the response's `total` count.
- `create(newTransaction: NewTransaction): TransactionRecord`
- `update(id: string, userId: string, patch: TransactionPatch, updatedAt: Date): TransactionRecord | null` —
  returns `null` if the scoped row doesn't exist (caller maps to `NotFoundError`, §6).
- `deleteById(id: string, userId: string): boolean` — returns whether a row was actually deleted.

`TransactionFilter` is a plain object: `{ category?, type?, dateFrom?, dateTo?, sort }` — the
repository receives an already-resolved date window, not the raw `timeframe` string; resolving
`timeframe` → concrete dates is a Service-layer concern (business rule, not persistence, per
`rules/architecture.md` Repository Layer rules: "MUST NOT contain business rules").

No `transaction-persistence.ts` unit-of-work wrapper: unlike `profile` (which bundles two
repositories plus a shared `runInTransaction`), `transactions` has exactly one repository and no
operation needs multi-repository atomicity, so `TransactionService` depends on
`TransactionRepository` directly (`rules/conventions.md` "avoid unnecessary abstractions").

## 4. Service Layer

New file `backend/src/features/transactions/transaction-service.ts`, constructed with:
`transactionRepository: TransactionRepository`, `clock: Clock`.

### 4.1 `listTransactions(userId, query): { data: Transaction[]; total: number }`

- `query`: `page`, `limit`, `category?`, `type?`, `timeframe`, `sort`.
- Resolves `timeframe` to a concrete `[dateFrom, dateTo)` window using `clock.now()` (business
  rule, kept out of the repository per §3):
  - `"this_week"` → the 7-day window containing today (week-start convention flagged §9).
  - `"this_month"` → first through last calendar day of the current month.
  - `"this_year"` → January 1 through December 31 of the current year.
  - `"all_time"` → no date predicate at all.
- Calls `transactionRepository.findManyByUserId` and `.countByUserId` with the same resolved
  filter, so the returned `total` always matches the paginated `data`'s filter (not the
  unfiltered table).
- Returns `{ data, total }` matching `fds.md` §5's `getTransactions` response shape.

### 4.2 `createTransaction(userId, input): Transaction`

- `input`: `date`, `description`, `category`, `type`, `amount` (`fds.md` §5 `createTransaction`
  body).
- Validates per §7, then `transactionRepository.create({ id: randomUUID(), userId, ...input,
createdAt: now, updatedAt: now })`.
- Returns the created `Transaction`.

### 4.3 `updateTransaction(userId, id, input): Transaction`

- Same field set and validation as `createTransaction` (`fds.md` §5 `updateTransaction` body takes
  the full field set, not a partial patch — **resolved design decision:** all five fields are
  required on update, mirroring the Edit modal's fully-prefilled form in `behavior.md` §3, unlike
  `profile`'s partial-patch `updateProfile`).
- `transactionRepository.update(id, userId, input, now)`; if it returns `null` (row absent or
  owned by another user) → throw `NotFoundError` (§6).
- Returns the updated `Transaction`.

### 4.4 `deleteTransaction(userId, id): void`

- `transactionRepository.deleteById(id, userId)`; if it returns `false` → throw `NotFoundError`.

## 5. Proposed Routes (field lists and rules — not a formal contract)

All four routes require authentication (reuse `requireAuth` / `getAuthenticatedUserId`, same wiring
as `profile-router.ts`).

### 5.1 `getTransactions` — intent: list the caller's transactions, paginated and filtered

- Reads (query params): `page` (integer ≥ 1, default `1`), `limit` (integer ≥ 1, default and max
  **flagged as an open item, §9** — recommend fixing a concrete number during Build, e.g. `10`),
  `category` (one of the 10 enum values, optional — omitted/absent means "All Category"),
  `type` (`"income"` \| `"expense"`, optional — omitted means "All Types"), `timeframe`
  (`"this_week"` \| `"this_month"` \| `"this_year"` \| `"all_time"`, default `"this_month"`),
  `sort` (`"newest"` \| `"oldest"`, default `"newest"` — exact wire values flagged §9, chosen here
  to match `behavior.md`'s "Newest First" label rather than inventing `date_desc`/`date_asc`).
- Writes: nothing.
- Returns: `{ data: Transaction[], total: number }` — `total` is the filtered count (§4.1), used by
  the frontend to compute page count (`behavior.md` §1, §4's "pagination count recalculates").
- Errors: `400 VALIDATION_ERROR` (out-of-range `page`/`limit`, unrecognized `category`/`type`/
  `timeframe`/`sort` value), `401 UNAUTHENTICATED`.

### 5.2 `createTransaction` — intent: add a new income or expense record

- Reads: `date`, `description`, `category`, `type`, `amount`.
- Writes: inserts one row scoped to the caller.
- Validation (§7): all five fields required; `date` valid `YYYY-MM-DD`; `description` 1–255 chars;
  `category` one of the 10 enum values; `type` one of `"income"`/`"expense"`; `amount` a positive
  number (`> 0`).
- Returns: the created `Transaction` object (`201 Created` per `fds.md` §5).
- Errors: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`.

### 5.3 `updateTransaction` — intent: edit an existing transaction (full replace of the editable fields)

- Reads: `id` (path), `date`, `description`, `category`, `type`, `amount` (body — all required,
  §4.3).
- Writes: replaces all five editable fields on the row identified by `id`, scoped to the caller.
- Validation: identical rules to `createTransaction` (§7).
- Returns: the updated `Transaction` object.
- Errors: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `404 NOT_FOUND` (id absent or owned by
  another user, §1).

### 5.4 `deleteTransaction` — intent: permanently remove a transaction

- Reads: `id` (path).
- Writes: deletes the row, scoped to the caller.
- Returns: `{ success: true, id }` (`fds.md` §5).
- Errors: `401 UNAUTHENTICATED`, `404 NOT_FOUND` (id absent or owned by another user).

## 6. Validation Rules Summary (from `fds.md` §2–§3, mapped to layers)

| Rule                                                      | Field(s)                                   | Authoritative layer                                                                                    |
| :-------------------------------------------------------- | :----------------------------------------- | :----------------------------------------------------------------------------------------------------- |
| Required, `YYYY-MM-DD` format                             | `date`                                     | Contract/Zod (parse + regex/`z.string().date()`-style check)                                           |
| Required, 1–255 characters                                | `description`                              | Contract/Zod                                                                                           |
| Required, one of 10 named categories                      | `category`                                 | Contract/Zod (`z.enum([...])`)                                                                         |
| Required, `"income"` \| `"expense"`                       | `type`                                     | Contract/Zod (`z.enum([...])`)                                                                         |
| Required, positive number (`> 0`)                         | `amount`                                   | Contract/Zod; DB `CHECK (amount > 0)` as a defensive second layer (same posture as `monthlyStartDate`) |
| Row must belong to the authenticated user                 | `updateTransaction`/`deleteTransaction` id | Service (`NotFoundError`, §1)                                                                          |
| `page`/`limit` positive integers; enum query params valid | `getTransactions` query                    | Contract/Zod                                                                                           |

## 7. New Error Codes Needed

None. `fds.md` §5/§6 only implies statuses already covered by the existing shared catalog in
`packages/contracts/src/common/error-body.ts`: `VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401),
and the already-generic `NOT_FOUND` (404, currently used for unmatched routes — reused here for "no
such transaction for this user", the same generic-reuse pattern `profile`'s backend fragment used
for `clearAllUserData`'s literal-mismatch `VALIDATION_ERROR`, §8). No new `DomainError` subclass is
needed beyond one small `NotFoundError` in a new `backend/src/features/transactions/
transaction-errors.ts` (mirrors `profile-errors.ts`'s structure) that carries the existing
`ERROR_CODES.NOT_FOUND` code — `ERROR_STATUS` in `backend/src/shared/errors/error-handler.ts`
already maps it to 404, so that file needs no edit either.

## 8. Resolved Design Decisions (self-resolved this attempt — not escalated)

1. Cross-user id access returns `404 NOT_FOUND`, identical to a missing id, rather than `403` (§1).
2. No `transaction-persistence.ts` unit-of-work wrapper; the service depends on the single
   repository directly (§3).
3. `updateTransaction` requires the full field set (no partial patch), matching the Edit modal's
   always-prefilled form (§4.3).
4. `timeframe` → date-window resolution is Service-layer business logic, not a Repository concern
   (§3, §4.1).
5. SQLite CHECK constraints are added only for `amount > 0`; `description` length and the
   `category`/`type` enums rely on Contract/Zod validation plus Drizzle's TS-level `text({ enum })`
   typing, matching exactly how `profile.ts` treats `preferredCurrency`/`language` (no CHECK) versus
   `monthlyStartDate` (CHECK) (§2).

## 9. Flagged for Synthesizer / Integration — non-blocking, but needs a decision recorded

1. **`limit`'s default and maximum value are not specified anywhere in `fds.md`/`behavior.md`.**
   The visual mock (`features/transactions/visuals/transactions-page.png`) happens to show 9 rows
   on page 1, which is likely incidental mock data, not a specified page size. Recommend the
   Synthesizer/Build phase fix a concrete default (e.g. `10`) and maximum (e.g. `100`) as named
   constants, the same way `profile`'s backend fragment deferred its exact message-string wording to
   Build.
2. **`sort`'s wire values (`"newest"`/`"oldest"`) are this fragment's own choice**, not stated
   verbatim in `fds.md` (which only says "Newest/Oldest sorting" in prose, REQ-TXN-04). If the
   Frontend Fragment's dropdown independently proposes different wire values (e.g. `"date_desc"`),
   the Synthesizer should reconcile to one of the two rather than carry both.
3. **`"this_week"`'s start-of-week convention (Monday vs. Sunday vs. rolling 7 days) is not stated**
   in `fds.md`. This fragment computes it in the Service layer (§4.1) as an isolated, swappable
   rule so the exact convention can be confirmed at Build without touching the Repository or route
   contract. Recommend confirming this with the developer before or during Build.
4. **Tie-break ordering for same-`date` rows** (`created_at` ascending/descending alongside the
   requested `sort`, §3) is this fragment's own choice to keep pagination stable/deterministic;
   `fds.md` does not address it. Low-risk, but worth a one-line confirmation at Synthesis.

## 10. Unit Test Requirements (Vitest, Service + Repository layers)

**`TransactionRepository`**

- `findById` returns `null` for a nonexistent id, and for an id that exists but belongs to a
  different `userId`.
- `findManyByUserId` filters correctly by `category` alone, `type` alone, both together, and by
  each `dateFrom`/`dateTo` boundary (inclusive start, exclusive end).
- `findManyByUserId` sorts by `date` ascending and descending, with a deterministic tie-break for
  two rows sharing the same `date`.
- `findManyByUserId` paginates correctly (`limit`/`offset` boundaries: first page, last partial
  page, a page beyond the last page returns empty).
- `countByUserId` matches the length of an unpaginated `findManyByUserId` call with the same
  filter.
- `update` returns `null` when the row doesn't exist or belongs to another user, and does not
  mutate any other row.
- `deleteById` returns `false` for a nonexistent/foreign-owned id, `true` after deleting an owned
  row; the row is actually gone afterward.
- DB `CHECK (amount > 0)`: inserting `amount: 0` or a negative value fails at the database layer
  (defensive test, mirrors `profile`'s `monthlyStartDate` CHECK test).

**`TransactionService.listTransactions`**

- Each `timeframe` value resolves to the expected date window, exercised with a fixed test `Clock`
  (same `TestClock` pattern as `auth-test-harness.ts`): a transaction dated just inside vs. just
  outside each window's boundary is included/excluded correctly.
- `"all_time"` returns transactions regardless of date.
- `category`/`type` filters combine with `timeframe` (AND semantics, not OR).
- `total` always equals the filtered count, independent of the requested page/limit.

**`TransactionService.createTransaction` / `updateTransaction`**

- Rejects each of: empty `description`, a 256-character `description`, `amount <= 0`, an unknown
  `category`, an unknown `type`, a malformed `date`.
- `updateTransaction` on a foreign-owned or nonexistent id throws `NotFoundError`.
- `updateTransaction` replaces all five fields (no stale field survives from the prior version).

**`TransactionService.deleteTransaction`**

- Deletes an owned transaction.
- Throws `NotFoundError` for a foreign-owned or nonexistent id.

## 11. API / Integration Test Requirements (route level, extend the `startTestApp` harness pattern from `backend/src/test-support/auth-test-harness.ts`)

- All four routes return `401 UNAUTHENTICATED` with no/invalid/expired Bearer token.
- `GET /api/v1/transactions`: `200` with `{ data, total }`; default `timeframe`/`sort` applied when
  omitted; each filter query param exercised individually and in combination; `400
VALIDATION_ERROR` for an invalid `category`/`type`/`timeframe`/`sort`/`page`/`limit` value.
- `POST /api/v1/transactions`: `201` with the created `Transaction` on valid input; `400
VALIDATION_ERROR` (with `fieldErrors`) for each invalid field individually.
- `PUT /api/v1/transactions/:id`: `200` with the updated `Transaction` for the owner; `404
NOT_FOUND` for a nonexistent id and for another authenticated user's id (register a second test
  user, create a transaction as user A, attempt the update as user B).
- `DELETE /api/v1/transactions/:id`: `200` with `{ success: true, id }` for the owner; `404
NOT_FOUND` for a nonexistent id and for another user's id; a follow-up `GET` no longer includes the
  deleted row and `total` decreases by one.
- Cross-feature regression check: existing `auth` and `profile` route test suites continue to pass
  unmodified.

Coverage note: `fds.md` frontmatter sets `coverage_target: 90` for this feature (higher than
`profile`'s `85`) — relevant to Phase 8c's SonarQube Full Quality Gate (`rules/workflow.md` §7), not
actioned in this planning fragment but worth carrying forward into Build/Test Build Mode task
sizing.
