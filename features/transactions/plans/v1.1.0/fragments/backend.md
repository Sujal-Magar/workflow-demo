# Backend Fragment — `transactions` v1.1.0

> **SUPERSEDED.** Stale after revision 4. Kept as an audit trail only; do not use as synthesis input. The authoritative sources are `../plan.md` and `../contract.md`.

Scope: Backend + Backend-Testing only (data model, migration, repository, service, validation
rules, route intents as plain field/rule lists, and unit/API test requirements). No formal API
contract, no Frontend, no Integration content. A separate Frontend Fragment is drafted
independently; this fragment does not assume or depend on its contents.

## 0. Context

### 0.1 What v1.1.0 changes (from `fds.md` changelog 1.1.0)

1. New required field `title` (string, 1–100 characters) on `Transaction`.
2. `date` is no longer client-supplied. The server sets it on create to the current calendar date
   **in UTC** (`YYYY-MM-DD`), and it never changes on update.
3. `createTransaction` and `updateTransaction` bodies become `title`, `description`, `category`,
   `type`, `amount` (no `date`).
4. Existing rows get `title = SUBSTR(description, 1, 100)` when the migration adds the column.

Nothing else changes: the list query (`page`, `limit`, `category`, `type`, `timeframe`, `sort`),
the delete route, auth scoping, error codes and statuses all stay as they are.

### 0.2 Prior stop, now resolved

The previous Backend Fragment attempt for v1.1.0 stopped (see `../../activity-log.md`, entry
`2026-10-04T04:29:25Z`) on two gaps. Both are now answered in `fds.md` (commit `125752f`):

- **Backfill for pre-existing rows:** `fds.md` §2 `title` row: "existing records populate `title`
  from the first 100 characters of `description` (`SUBSTR(description, 1, 100)`)".
- **Timezone of the server-set `date`:** `fds.md` §2 `date` row and §5 `createTransaction`: "the
  current calendar date in UTC".

### 0.3 Baseline this fragment builds on

v1.0.0 was built through Integration (`activity-log.md`, `Build: Integration | 2026-10-04T04:02Z`).
The existing code is the starting point:

- `backend/src/db/schema/transactions.ts`, migration `0002_init_transactions.sql`
- `backend/src/features/transactions/transaction-{repository,service,router,errors,constants}.ts`
- `packages/contracts/src/transactions/transaction-{contract,shapes,validation}.ts`

Phase 8 (Test Build) never ran for v1.0.0, so `backend/src/features/transactions/` has **no test
files**. The test requirements in §10–§11 cover the whole feature as it stands at v1.1.0, not
only the v1.1.0 change.

## 1. Cross-Feature Integration with `auth` (unchanged)

Every transaction belongs to one user (`transactions.user_id`, FK → `users.id`, cascade delete).
All four routes keep `requireAuth` and `getAuthenticatedUserId(req)`. Repository lookups keep
taking `(id, userId)` together, so a cross-user id returns `404 NOT_FOUND`, the same as a missing
id. No `auth` or `profile` file is touched.

## 2. Data Model / Drizzle Schema Changes

### 2.1 `transactions` table, v1.1.0

| Column        | Type (Drizzle)                            | Change in v1.1.0                                                                                                                         |
| :------------ | :---------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | `text` PK                                 | unchanged                                                                                                                                |
| `user_id`     | `text` NOT NULL, FK → `users.id`, cascade | unchanged                                                                                                                                |
| `title`       | `text` NOT NULL                           | **new.** 1–100 characters, enforced at contract/Zod level. No DB default, no CHECK (same posture as `description`, v1.0.0 decision §8.5) |
| `date`        | `text` NOT NULL                           | column unchanged; now written only by the Service on create (§4.2), never by update                                                      |
| `description` | `text` NOT NULL                           | unchanged                                                                                                                                |
| `category`    | `text` enum NOT NULL                      | unchanged                                                                                                                                |
| `type`        | `text` enum NOT NULL                      | unchanged                                                                                                                                |
| `amount`      | `real` NOT NULL, CHECK `amount > 0`       | unchanged (CHECK must survive the migration, §2.2)                                                                                       |
| `created_at`  | `text` NOT NULL                           | unchanged                                                                                                                                |
| `updated_at`  | `text` NOT NULL                           | unchanged                                                                                                                                |

Indexes `transactions_user_id_idx` and `transactions_user_id_date_idx` are unchanged (and must be
recreated by the migration, §2.2).

Edit to `backend/src/db/schema/transactions.ts`: add `title: text("title").notNull()` after
`userId`, and update the header comment (`date` is now server-set, UTC).

### 2.2 Migration `0003_*` (hand-finished)

Generated with the existing `pnpm --filter backend db:generate` (`drizzle-kit generate`, 0.24) so
`meta/0003_snapshot.json` and the `_journal.json` entry come from the tool. The SQL body is then
**rewritten by hand**, the same way `0002_init_transactions.sql` hand-adds its CHECK, because:

- On a table that already has rows, SQLite rejects `ALTER TABLE … ADD COLUMN … NOT NULL` without
  a non-null default (`Cannot add a NOT NULL column with default value NULL`, checked against the
  project's `better-sqlite3`). It works on an empty table, so a test against a fresh DB would
  not catch it, but any dev or prod `data/app.db` with transactions would fail to start.
- Adding `DEFAULT ''` to get around that would leave a DB default that the Drizzle schema and
  snapshot do not declare (silent drift), and an empty string violates the 1–100 rule.
- The FDS requires the backfill value `SUBSTR(description, 1, 100)`.

Required migration shape (table rebuild, the standard SQLite pattern for adding a NOT NULL column
to a populated table):

1. `CREATE TABLE __new_transactions (…)` with the full v1.1.0 column list, the `user_id` FK
   (`ON DELETE cascade`) and `CONSTRAINT transactions_amount_check CHECK (amount > 0)`.
2. `INSERT INTO __new_transactions (id, user_id, title, date, description, category, type, amount, created_at, updated_at) SELECT id, user_id, SUBSTR(description, 1, 100), date, description, category, type, amount, created_at, updated_at FROM transactions;`
3. `DROP TABLE transactions;`
4. `ALTER TABLE __new_transactions RENAME TO transactions;`
5. Recreate `transactions_user_id_idx` and `transactions_user_id_date_idx`.

Statements are separated with `--> statement-breakpoint`, as in the existing migrations. No
`PRAGMA foreign_keys` toggling is needed: no table references `transactions`, and the Drizzle
migrator runs inside a transaction where that pragma has no effect anyway.

Existing rows keep their stored `date` values (user-entered under v1.0.0); only new rows get the
server-set UTC date.

## 3. Repository Layer (`transaction-repository.ts`)

| Item                                                                         | Change                                                                                                       |
| :--------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| `TransactionRecord`                                                          | add `readonly title: string`                                                                                 |
| `NewTransaction`                                                             | add `readonly title: string`; `date` stays (the Service supplies it, §4.2)                                   |
| `TransactionUpdate`                                                          | add `readonly title: string`; **remove `date`**, so the type system stops an update from ever writing it     |
| `toTransactionRecord`                                                        | map `row.title`                                                                                              |
| `create`                                                                     | write `title`                                                                                                |
| `update`                                                                     | unchanged code (`set({ ...patch, updatedAt })`); `date` cannot be written once it leaves `TransactionUpdate` |
| `findById`, `findManyByUserId`, `countByUserId`, `deleteById`, `whereClause` | unchanged                                                                                                    |

No new repository methods. Sort order is unchanged (`date` then `created_at`, in the requested
direction). See §9.3 on why `created_at` now carries most of the ordering.

## 4. Service Layer (`transaction-service.ts`)

Constructor dependencies unchanged: `transactionRepository`, `clock`.

### 4.1 `toTransaction`

Add `title: record.title` to the mapped API shape.

### 4.2 `createTransaction(userId, input)`

- `input`: `title`, `description`, `category`, `type`, `amount`.
- Business rule (new): `date = formatDate(clock.now())`, i.e. the UTC calendar date of the
  creation instant. The existing `formatDate` helper (`toISOString().slice(0, 10)`) already
  produces the UTC date; reuse it, do not add a second helper. Take `now` once and use it for both
  `date` and `createdAt`, so they can never disagree across a UTC midnight boundary.
- This also keeps `date` consistent with `resolveDateWindow`, which already computes the timeframe
  windows in UTC. A transaction created "today" always lands in `this_week`, `this_month` and
  `this_year`.

### 4.3 `updateTransaction(userId, id, input)`

- `input`: `title`, `description`, `category`, `type`, `amount`. Still a full replace of the
  editable fields (v1.0.0 decision D-01), but `date` is no longer editable.
- Passes `{ title, description, category, type, amount }` to `transactionRepository.update`.
  `date` and `createdAt` are left as stored; `updatedAt` is set from `clock.now()` as today.
- `null` from the repository → `TransactionNotFoundError` (unchanged).

### 4.4 `listTransactions`, `deleteTransaction`

Unchanged.

## 5. Proposed Routes (field lists and rules — not a formal contract)

All four routes keep `requireAuth`. Router code (`transaction-router.ts`) needs no change: the
handlers already pass `body` straight to the service, and the new field set reaches them through
the contract's request schemas.

### 5.1 `getTransactions` — list the caller's transactions, paginated and filtered

- Reads (query): unchanged — `page`, `limit`, `category`, `type`, `timeframe`, `sort`.
- Returns: `{ data: Transaction[], total: number }`. Each `Transaction` now includes `title`.
- Errors: unchanged — `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`.

### 5.2 `createTransaction` — add a new income or expense record, dated today (UTC)

- Reads (body): `title`, `description`, `category`, `type`, `amount`.
- Does not read `date`. A `date` key in the body is ignored (§8.2).
- Writes: one row scoped to the caller, with `date` set by the server (§4.2).
- Returns: `201` with the created `Transaction` (including `title` and the server-set `date`).
- Errors: `400 VALIDATION_ERROR` (with `fieldErrors`), `401 UNAUTHENTICATED`.

### 5.3 `updateTransaction` — edit an existing transaction

- Reads: `id` (path); body `title`, `description`, `category`, `type`, `amount` (all required).
- Does not read `date`. A `date` key in the body is ignored, and the stored `date` is unchanged.
- Writes: replaces the five editable fields on the caller's row.
- Returns: `200` with the updated `Transaction`; its `date` equals the value from creation.
- Errors: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `404 NOT_FOUND`.

### 5.4 `deleteTransaction` — permanently remove a transaction

Unchanged: `{ success: true, id }`; `401`, `404`.

### 5.5 Shared-contract changes the backend needs (`packages/contracts/src/transactions/`)

Described as intents; the Synthesizer formalizes them in `contract.md`:

- **Response shape** (`transactionSchema`): add `title` (string).
- **Create and update request shapes**: add `title`; remove `date`.
- **New `Title` rule set**: see §6.
- **Remove the now-unused `TransactionDate` rule set** (`transactionDateSchema`,
  `isValidCalendarDate`, `DATE_PATTERN`, and the `DATE_REQUIRED` / `DATE_INVALID` messages) once
  nothing references it, so it does not linger as dead exported code. A repo search shows no
  importer outside `transaction-validation.ts`; the frontend keeps its own local copy in
  `frontend/src/features/transactions/lib/transaction-form-schemas.ts`, which is not this
  fragment's concern.

## 6. Validation Rules Summary

| Rule                                                     | Field(s)                | Authoritative layer                                     | v1.1.0 change                                   |
| :------------------------------------------------------- | :---------------------- | :------------------------------------------------------ | :---------------------------------------------- |
| Required; trimmed; 1–100 characters                      | `title`                 | Contract/Zod (`Title` rule set)                         | **new**                                         |
| Required; trimmed; 1–255 characters                      | `description`           | Contract/Zod                                            | unchanged                                       |
| Required; one of the 10 categories                       | `category`              | Contract/Zod                                            | unchanged                                       |
| Required; `income` \| `expense`                          | `type`                  | Contract/Zod                                            | unchanged                                       |
| Required; finite number `> 0`                            | `amount`                | Contract/Zod + DB `CHECK (amount > 0)`                  | unchanged                                       |
| Server-set to the UTC calendar date on create; immutable | `date`                  | Service (§4.2) + `TransactionUpdate` type (§3)          | **changed** (was client-validated `YYYY-MM-DD`) |
| Row must belong to the caller                            | update/delete `id`      | Repository scoping → Service `TransactionNotFoundError` | unchanged                                       |
| Enum and range checks on list query params               | `getTransactions` query | Contract/Zod                                            | unchanged                                       |

`Title` rule set, proposed to mirror the existing `Description` rule set exactly (same
`z.custom().transform()` style, trim first, then check length), with one message per failure:

- empty after trim → a "Title is required."-style message
- longer than 100 characters after trim → a "Title must be at most 100 characters."-style message
- add a named constant `TITLE_MAX_LENGTH = 100` next to `DESCRIPTION_MAX_LENGTH`

The exact message strings are for the Synthesizer to fix in `contract.md` §4, as v1.0.0 did for
the other rule sets.

## 7. Error Codes

No new error codes, `DomainError` subclasses or HTTP statuses. `VALIDATION_ERROR` (400) covers
title violations; `NOT_FOUND`, `UNAUTHENTICATED` are unchanged. `error-handler.ts` and
`validation-error.ts` need no edit.

## 8. Resolved Design Decisions (self-resolved — not escalated)

1. **Table-rebuild migration instead of `ADD COLUMN … DEFAULT ''`** (§2.2). Keeps the DB, the
   Drizzle schema and the snapshot in agreement and applies the FDS backfill exactly.
2. **A client-sent `date` is silently stripped, not rejected.** The existing request schemas are
   plain `z.object`s, which strip unknown keys (v1.0.0 contract §1). Treating `date` the same way
   keeps one policy for all unknown fields and satisfies the FDS "never supplied by the client"
   rule: the value can never reach the Service. Tests pin this (§11).
3. **`date` is removed from `TransactionUpdate`**, so "never changed on update" is enforced by the
   type system, not only by Service code (§3).
4. **One `clock.now()` per create**, shared by `date` and `createdAt` (§4.2).
5. **`Title` mirrors `Description`** (trim, then 1–100), keeping the rule sets uniform (§6).
6. **No DB CHECK on `title` length**, matching how `description` is treated (§2.1).

## 9. Flagged for Synthesizer — non-blocking, needs a recorded decision

1. **Backfilled titles are not re-trimmed.** `SUBSTR(description, 1, 100)` is applied verbatim, as
   the FDS specifies. Stored descriptions are already trimmed, so a backfilled title is never
   empty, but a cut at character 100 can end in a space (for example `"…coffee "`). This is only
   cosmetic: the next edit trims it through the `Title` rule set. Recommend accepting it as is
   rather than deviating from the FDS formula with `RTRIM`.
2. **Character counting differs between SQLite and JavaScript.** SQLite `SUBSTR` counts Unicode
   characters; Zod's `.length` counts UTF-16 code units (checked: `SUBSTR('😀😀😀', 1, 2)` has a JS length of 4). A legacy description with emoji or other
   astral-plane characters in its first 100 characters can therefore backfill a title whose JS
   length is over 100. Reads are unaffected (the response schema has no length bound). But if that
   row is opened in Edit and saved unchanged, the update fails with "Title must be at most 100
   characters." Expected impact is tiny (only pre-1.1.0 rows, and only with such characters).
   Recommend accepting and recording it, not adding code for it.
3. **Ordering inside a day now depends almost entirely on `created_at`.** Every transaction made
   on the same UTC day shares one `date`, so the existing `created_at` tie-break becomes the main
   ordering for new rows. It is still deterministic except for two rows created in the same
   millisecond. Optional hardening: add `id` as a final tie-break in `findManyByUserId`. Recommend
   leaving it out unless the Synthesizer wants strict pagination stability.
4. **UTC vs. the user's local day.** For users far from UTC, a transaction made late in the
   evening, local time, is dated the next day (or, east of UTC, early morning lands on the
   previous day). This is what the FDS specifies, and it matches the UTC timeframe windows, so no
   change is proposed. It is recorded here so it does not come back as a defect report.

## 10. Unit Test Requirements (Vitest)

Use an in-memory DB via `createTestDatabase()` and the fixed `TestClock` from
`backend/src/test-support/auth-test-harness.ts`. Each test sets up its own data.

### 10.1 Migration (`backend/src/db/client.test.ts` or a new `migrations.test.ts`)

- **Backfill:** apply migrations up to `0002` only (copy the migrations folder to a temp dir with
  `_journal.json` cut to the first three entries), insert legacy rows, then run the full
  `runMigrations`, which applies only `0003`. Assert:
  - a row with a short description gets `title === description`;
  - a row with a 255-character description gets `title` equal to its first 100 characters;
  - `date`, `description`, `amount`, `created_at` and `updated_at` are unchanged.
- **Constraints survive the rebuild:** after migrating, inserting `amount <= 0` fails
  (`transactions_amount_check`), inserting with no `title` fails (NOT NULL), and deleting the
  owning user cascades to their transactions.
- **Indexes survive:** `transactions_user_id_idx` and `transactions_user_id_date_idx` exist in
  `sqlite_master`.
- The existing "creates every … table" and "idempotent" tests still pass; no `__new_transactions`
  table is left behind.

### 10.2 `TransactionRepository`

- `create` persists and returns `title`; `findById` reads it back.
- `update` writes `title`, `description`, `category`, `type`, `amount`, and leaves `date` and
  `createdAt` unchanged.
- `findById` returns `null` for a missing id and for another user's id.
- `findManyByUserId` filters by `category`, by `type`, by both, and by `dateFrom` (inclusive) and
  `dateTo` (exclusive) boundaries.
- `findManyByUserId` sorts `newest` and `oldest` by `date`, then `createdAt`, including two rows
  that share a `date`.
- Pagination: first page, last partial page, and a page past the end (empty).
- `countByUserId` equals the length of the unpaginated result for the same filter.
- `update` and `deleteById` return `null` / `false` for a missing or foreign id and touch no other
  row; after a successful `deleteById`, the row is gone.

### 10.3 `TransactionService`

**`createTransaction`**

- Sets `date` to the UTC calendar date of `clock.now()`.
- Day boundaries: clock at `2026-10-04T23:59:59.999Z` → `"2026-10-04"`; clock at
  `2026-10-05T00:00:00.000Z` → `"2026-10-05"`.
- A clock instant that is still the previous day in a negative-offset zone (for example
  `2026-10-05T03:00:00.000Z`, which is `2026-10-04` in UTC−5) → `"2026-10-05"`. This proves the
  date is UTC and not server-local, even if the test runner's `TZ` is not UTC.
- `createdAt` equals the same `clock.now()` instant used for `date`.
- Returns `title` and the other input fields unchanged.

**`updateTransaction`**

- Changes `title` (and the other editable fields). Advance the `TestClock` by several days
  between create and update: `date` stays the creation date, `updatedAt` moves.
- Replaces all five editable fields; no stale value survives.
- A missing or foreign id throws `TransactionNotFoundError`.

**`listTransactions`**

- Each `timeframe` value resolves to the right window: a row just inside and a row just outside
  each boundary, with a fixed clock. `this_week` starts on Monday (v1.0.0 D-06).
- `all_time` applies no date predicate.
- `category` and `type` combine with `timeframe` as AND.
- `total` is the filtered count, independent of `page` and `limit`.
- A transaction created through `createTransaction` appears under `this_week`, `this_month` and
  `this_year` for the same clock.

**`deleteTransaction`**

- Deletes an owned row; throws `TransactionNotFoundError` for a missing or foreign id.

### 10.4 Contract validation (`packages/contracts/src/transactions/transaction-validation.test.ts`, new)

- `Title`: missing, `""`, and whitespace-only → required message; 101 characters after trim →
  max-length message; exactly 100 → accepted; leading and trailing spaces are trimmed in the
  parsed output.
- Create and update schemas: a body with `date` parses successfully and the parsed output has no
  `date` key.
- Create and update schemas: a body without `title` fails with a `title` field error.
- The existing rule sets (`Description`, `Category`, `Type`, `Amount`, `Page`, `Limit`,
  `CategoryFilter`, `TypeFilter`, `Timeframe`, `Sort`) each get accept and reject cases, since
  none have tests today.

## 11. API / Integration Test Requirements

Route-level, using `startTestApp` and `sendRequest` from `auth-test-harness.ts` with the
harness's `TestClock`.

- All four routes return `401 UNAUTHENTICATED` with no, invalid or expired Bearer token.
- `POST /api/v1/transactions`
  - `201`; the response includes `title`, and `date` equals the UTC date of the test clock.
  - A body that also sends `"date": "1999-01-01"` → `201`, and the response `date` is the
    clock's UTC date, not `1999-01-01`.
  - `400 VALIDATION_ERROR` with a `title` entry in `fieldErrors` for missing, empty,
    whitespace-only and 101-character titles.
  - `400` with the matching `fieldErrors` entry for each other invalid field.
- `PUT /api/v1/transactions/:id`
  - `200`; the response reflects the new `title` and other fields; `date` equals the creation
    date even after the clock has moved forward several days.
  - A body that also sends `date` → `200`, and the stored `date` is unchanged (confirm with a
    follow-up `GET`).
  - `400` for an invalid `title`.
  - `404 NOT_FOUND` for a missing id and for another user's id (register a second user).
- `GET /api/v1/transactions`
  - `200`; every item in `data` has `title`.
  - Defaults (`this_month`, `newest`) are applied when the query is empty.
  - Each filter alone and in combination; `400` for each invalid query value.
  - A transaction just created through `POST` appears in the default view.
- `DELETE /api/v1/transactions/:id`
  - `200` with `{ success: true, id }`; a follow-up `GET` no longer includes the row and `total`
    drops by one.
  - `404` for a missing id and for another user's id.
- Regression: the existing `auth`, `profile`, `app` and `db/client` suites pass unchanged, apart
  from the deliberate migration additions in §10.1.

Coverage: `fds.md` sets `coverage_target: 90`, which applies at Phase 8c. With no transactions
tests in place today, §10–§11 are sized to reach it for `backend/src/features/transactions/` and
`packages/contracts/src/transactions/`.

## 12. Files Touched (backend and contracts only)

| File                                                                 | Change                                                                                                       |
| :------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| `backend/src/db/schema/transactions.ts`                              | add `title`; update header comment                                                                           |
| `backend/src/db/migrations/0003_<generated-name>.sql`                | new; generated, then hand-rewritten to the table rebuild in §2.2                                             |
| `backend/src/db/migrations/meta/0003_snapshot.json`, `_journal.json` | generated by `drizzle-kit generate`                                                                          |
| `backend/src/features/transactions/transaction-repository.ts`        | `title` in record, insert and update types; `date` out of `TransactionUpdate`                                |
| `backend/src/features/transactions/transaction-service.ts`           | server-set UTC `date` on create; `title` mapping; update no longer passes `date`                             |
| `packages/contracts/src/transactions/transaction-shapes.ts`          | `title` in `transactionSchema`                                                                               |
| `packages/contracts/src/transactions/transaction-validation.ts`      | `Title` rule set and messages; request shapes swap `date` for `title`; remove the `TransactionDate` rule set |
| `backend/src/features/transactions/transaction-router.ts`            | no change expected                                                                                           |
| Tests (new)                                                          | per §10–§11                                                                                                  |
