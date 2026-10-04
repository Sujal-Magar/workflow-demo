# API Contract: transactions (v1.1.0)

- **Feature:** `transactions` (Transactions Management)
- **FDS version:** 1.1.0 (`features/transactions/fds.md`, changelog entry 1.1.0 dated 2026-10-04, including the clarification commit that fixed the `title` backfill formula and the UTC basis of the server-set `date`)
- **Produced by:** Plan Synthesizer, from `fragments/frontend.md` §5 and `fragments/backend.md` §5–§6
- **Supersedes:** `../v1.0.0/contract.md` (frozen, built through Integration). That file stays as history. This file is complete on its own: it restates every operation, not only the changed ones. §8 lists what changed.
- **Status:** Draft. Frozen at the Developer Approval Gate (Phase 4). After that, Backend Build, Frontend Build and Integration build against this file as written. Neither side may edit it.
- **Revision:** 2 (2026-10-04), after the second Plan Review returned CHANGES REQUIRED. §4 `Title` rule 1 now covers a present but non-string value (review A-8), matching how `Description` is built. No operation, shape, status or error code changed.
- **Revision 1** (2026-10-04), after the first Plan Review returned CHANGES REQUIRED. §2.3 gains the note on pre-1.1.0 rows dated after today (`directives.md` B-2; `plan.md` D-30). No operation, shape, status, rule set or error code changed.
- **Companion plan:** `plan.md` (same directory)

This document is the only source of truth for the Frontend/Backend interface of `transactions`. It is plain language on purpose and does not assume any framework. Updating the project's typed contract package to match it is a Backend Build task (`plan.md`, task BE-08).

`transactions` depends on `auth` and `profile` (`features/index.json`). Every operation reuses the authentication mechanism and the shared `ErrorBody` / error-code catalog defined in `features/auth/plans/v1.0.0/contract.md` (§2.5, §3, §9). Nothing here depends on `profile` at the API level. The frontend takes the currency symbol from the signed-in user's `preferredCurrency` (`plan.md` D-04).

---

## 1. General Conventions

| Topic                              | Rule                                                                                                                                                                                                                                                                                                        |
| :--------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base path                          | Every operation is served under `/api/v1/transactions`. Paths below are relative to it (`/:id` means `/api/v1/transactions/:id`).                                                                                                                                                                           |
| Body format                        | Request and response bodies are JSON (`Content-Type: application/json`).                                                                                                                                                                                                                                    |
| Unknown / not-accepted body fields | Ignored. They never cause an error, are never applied, and are never echoed back. In particular, `id`, `userId`, `date`, `createdAt` and `updatedAt` sent on a create or update request are silently dropped (`plan.md` D-17). A client-sent `date` therefore can never set or change a transaction's date. |
| Auth                               | Every operation requires `Authorization: Bearer <accessToken>`, exactly as `features/auth/plans/v1.0.0/contract.md` §9 defines. A missing, malformed, invalid or expired token returns `401 UNAUTHENTICATED` with the shared `ErrorBody` shape.                                                             |
| Scope                              | Every operation reads and writes only the transactions of the user identified by the access token. A transaction id that exists but belongs to another user behaves exactly like a non-existent id (`404 NOT_FOUND`), never `403` (`plan.md` D-02).                                                         |
| Server-set `date`                  | `date` is a plain `YYYY-MM-DD` calendar date with no time component. The server sets it once, at creation, to the **UTC** calendar date of the creation instant. The same instant is used for `createdAt`, so the two always agree. No operation ever changes it afterward (`fds.md` §2; `plan.md` D-16).   |
| Timestamps                         | `createdAt` / `updatedAt` are ISO-8601 UTC timestamp strings.                                                                                                                                                                                                                                               |
| Character counts                   | Length limits in §4 count the string's length in UTF-16 code units (the JavaScript string length), after trimming leading and trailing whitespace. This is the same counting `Description` already used in v1.0.0.                                                                                          |
| Undeclared outcomes                | The client treats any status or `code` not declared for an operation (including network failure and any `5xx`) as "unexpected" and applies a generic failure message. The server never returns a `2xx` other than the one declared per operation.                                                           |

---

## 2. Shared Shapes

### 2.1 `Transaction` (`fds.md` §2)

| Field         | Type                      | Notes                                                                                                                                                                                                                                                                          |
| :------------ | :------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | UUID string               | Primary key, generated by the server.                                                                                                                                                                                                                                          |
| `title`       | string                    | **New in v1.1.0.** Short name of the transaction. Always present and non-empty. Written through the `Title` rule set (§4). Records created before v1.1.0 carry the migration backfill `SUBSTR(description, 1, 100)` until they are next edited; see the note below this table. |
| `date`        | string (`YYYY-MM-DD`)     | **Read-only.** Set by the server at creation (§1 Server-set `date`). Records created before v1.1.0 keep the date the user entered at the time.                                                                                                                                 |
| `description` | string                    | 1–255 characters.                                                                                                                                                                                                                                                              |
| `category`    | enum (10 values, §2.4)    | Required. Independent of `type`: no category implies a fixed type.                                                                                                                                                                                                             |
| `type`        | `"income"` \| `"expense"` | Required. Carries the sign; `amount` itself is always positive.                                                                                                                                                                                                                |
| `amount`      | number                    | Always positive (`> 0`). Sign and currency symbol are display-only and added by the frontend (`plan.md` D-03).                                                                                                                                                                 |
| `createdAt`   | ISO timestamp string      | Record creation. Same instant as the one `date` was derived from.                                                                                                                                                                                                              |
| `updatedAt`   | ISO timestamp string      | Last update to any editable field.                                                                                                                                                                                                                                             |

`userId` is never part of this shape. It is an internal ownership column.

**Backfilled titles (records created before v1.1.0).** The backfill applies the FDS formula verbatim, so two edge cases exist and are accepted (`plan.md` D-20, D-21):

- A title cut at character 100 may end in a space. The next edit trims it through the `Title` rule set.
- SQLite counts characters as Unicode code points, but §4 counts UTF-16 code units. If a description has emoji or other astral-plane characters in its first 100 characters, the backfilled title can be longer than 100 UTF-16 code units. Such a title is still returned normally: the response shape does not apply the 1–100 bound. Saving that record unchanged fails the `Title` rule (`Title must be at most 100 characters.`) until the user shortens it.

### 2.2 `TransactionListQuery` (query params of `getTransactions`)

Unchanged from v1.0.0.

| Field       | Type                                                             | Required | Default                 | Notes                                                           |
| :---------- | :--------------------------------------------------------------- | :------- | :---------------------- | :-------------------------------------------------------------- |
| `page`      | integer ≥ 1                                                      | No       | `1`                     |                                                                 |
| `limit`     | integer, `1`–`100`                                               | No       | `10`                    | Named constants `DEFAULT_LIMIT = 10`, `MAX_LIMIT = 100` (D-08). |
| `category`  | one of the 10 values in §2.4                                     | No       | absent = "All Category" |                                                                 |
| `type`      | `"income"` \| `"expense"`                                        | No       | absent = "All Types"    |                                                                 |
| `timeframe` | `"this_week"` \| `"this_month"` \| `"this_year"` \| `"all_time"` | No       | `"this_month"`          | Closed enum (`fds.md` REQ-TXN-04 / §5 addendum). No `"today"`.  |
| `sort`      | `"newest"` \| `"oldest"`                                         | No       | `"newest"`              | `"newest"` = descending; `"oldest"` = ascending (§2.3).         |

Timeframe windows are computed in UTC, the same basis as the server-set `date`. A transaction created "now" therefore always falls inside `this_week`, `this_month` and `this_year` (`plan.md` D-06, D-16).

### 2.3 `TransactionListResponse` (body of `getTransactions` on success)

| Field   | Type            | Notes                                                                                                                                                                                                                                                                                                           |
| :------ | :-------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data`  | `Transaction[]` | The requested page. Ordered by `date`, then `createdAt`, then `id`, all descending under `"newest"` and all ascending under `"oldest"`. The `id` key is new in v1.1.0: it makes the order total, so paging never repeats or skips a row that ties on both `date` and `createdAt` (§7 C6; `plan.md` D-07, D-22). |
| `total` | integer         | Count of all transactions matching `category` / `type` / `timeframe`, ignoring pagination. Always computed with the same filter that produced `data`. Drives the frontend's page count.                                                                                                                         |

**Rows dated after today (records created before v1.1.0).** v1.0.0 accepted any valid calendar date, including future ones, and those dates are kept. Under `"newest"` such a row sorts above every row dated today, so a newly created transaction appears below it rather than at the very top of the list. This is accepted and transitional: no record created from v1.1.0 on can be dated after today, so the case ends once the calendar passes the last such date (`plan.md` D-30). The ordering keys above do not change for it.

### 2.4 `category` enum (`fds.md` §2)

`"food_and_dining"`, `"salary"`, `"transportation"`, `"shopping"`, `"investment"`, `"freelance_work"`, `"bills_and_utilities"`, `"health_and_fitness"`, `"savings_account"`, `"others"`.

### 2.5 `CreateTransactionRequest` (body of `createTransaction`) / `UpdateTransactionRequest` (body of `updateTransaction`)

Identical field set. `updateTransaction` replaces all editable fields; it is not a partial patch (`plan.md` D-01). **`date` is not part of either request** (§1).

| Field         | Type   | Rule set (§4) |
| :------------ | :----- | :------------ |
| `title`       | string | `Title`       |
| `description` | string | `Description` |
| `category`    | string | `Category`    |
| `type`        | string | `Type`        |
| `amount`      | number | `Amount`      |

### 2.6 `DeleteTransactionResponse` (body of `deleteTransaction` on success)

Unchanged from v1.0.0.

| Field     | Type        | Notes                         |
| :-------- | :---------- | :---------------------------- |
| `success` | boolean     | Always `true`.                |
| `id`      | UUID string | The id of the deleted record. |

---

## 3. Error Code Catalog

No new error codes. `transactions` reuses three codes from the shared catalog (`packages/contracts/src/common/error-body.ts`), unchanged:

| Code               | Status | Meaning here                                                                                    |
| :----------------- | :----- | :---------------------------------------------------------------------------------------------- |
| `VALIDATION_ERROR` | 400    | Request body or query params fail the rules in §4 / §2.2.                                       |
| `UNAUTHENTICATED`  | 401    | Missing, invalid or expired access token.                                                       |
| `NOT_FOUND`        | 404    | `updateTransaction` / `deleteTransaction` target id does not exist, or belongs to another user. |

Every operation may also return `500 INTERNAL_ERROR`; it is not repeated per operation.

---

## 4. Shared Validation Rule Sets

Each rule set runs its checks in order and reports the first that fails, with the exact message shown.

| Rule set         | Field(s)      | Rules in order → message                                                                                                                                                                               |
| :--------------- | :------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Title`          | `title`       | **New.** Trim leading/trailing whitespace first. 1. empty after trim, missing, or not a string → `Title is required.` 2. more than 100 characters after trim → `Title must be at most 100 characters.` |
| `Description`    | `description` | 1. empty after trim → `Description is required.` 2. more than 255 characters after trim → `Description must be at most 255 characters.`                                                                |
| `Category`       | `category`    | 1. empty → `Category is required.` 2. not one of the 10 values in §2.4 → `Select a valid category.`                                                                                                    |
| `Type`           | `type`        | 1. empty → `Type is required.` 2. not `"income"` / `"expense"` → `Select a valid type.`                                                                                                                |
| `Amount`         | `amount`      | 1. empty or not a number → `Amount is required.` 2. `amount <= 0` → `Amount must be greater than 0.`                                                                                                   |
| `Page`           | `page`        | 1. present and not an integer ≥ 1 → `Page must be a positive integer.`                                                                                                                                 |
| `Limit`          | `limit`       | 1. present and not an integer in `1`–`100` → `Limit must be between 1 and 100.`                                                                                                                        |
| `CategoryFilter` | `category`    | 1. present and not one of the 10 values in §2.4 → `Select a valid category.`                                                                                                                           |
| `TypeFilter`     | `type`        | 1. present and not `"income"` / `"expense"` → `Select a valid type.`                                                                                                                                   |
| `Timeframe`      | `timeframe`   | 1. present and not one of `"this_week"` / `"this_month"` / `"this_year"` / `"all_time"` → `Select a valid timeframe.`                                                                                  |
| `Sort`           | `sort`        | 1. present and not `"newest"` / `"oldest"` → `Select a valid sort order.`                                                                                                                              |

The v1.0.0 `TransactionDate` rule set (`Date is required.` / `Enter a valid date.`) is **removed**: no request carries a date any more.

The parsed `title` and `description` values are the trimmed strings; that is what gets stored.

**Composed request rule sets:**

| Composed set               | Fields → rule set                                                                                                        | Used by             |
| :------------------------- | :----------------------------------------------------------------------------------------------------------------------- | :------------------ |
| `CreateTransactionRequest` | `title`→`Title`; `description`→`Description`; `category`→`Category`; `type`→`Type`; `amount`→`Amount`                    | `createTransaction` |
| `UpdateTransactionRequest` | identical to `CreateTransactionRequest`; all five fields required (D-01)                                                 | `updateTransaction` |
| `TransactionListQuery`     | `page`→`Page`; `limit`→`Limit`; `category`→`CategoryFilter`; `type`→`TypeFilter`; `timeframe`→`Timeframe`; `sort`→`Sort` | `getTransactions`   |

---

## 5. Operations

### 5.1 `getTransactions`: list the caller's transactions, paginated and filtered

| Item          | Value                                                                      |
| :------------ | :------------------------------------------------------------------------- |
| Method & path | `GET /` (that is, `GET /api/v1/transactions`)                              |
| Auth          | Bearer                                                                     |
| Request       | Query: `TransactionListQuery` (§2.2)                                       |
| Success       | `200`, body `TransactionListResponse` (§2.3). Every item includes `title`. |

| Status | `code`             | When                                              | `fieldErrors` keys                                              |
| :----- | :----------------- | :------------------------------------------------ | :-------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR` | Any query param fails `TransactionListQuery` (§4) | any of `page`, `limit`, `category`, `type`, `timeframe`, `sort` |

### 5.2 `createTransaction`: add a new income or expense record, dated today (UTC)

| Item          | Value                                                                                                                                                              |
| :------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Method & path | `POST /`                                                                                                                                                           |
| Auth          | Bearer                                                                                                                                                             |
| Request body  | `CreateTransactionRequest` (§2.5). A `date` key, if sent, is dropped (§1).                                                                                         |
| Effect        | Creates one record owned by the caller. The server sets `date` to the UTC calendar date of the creation instant and sets `createdAt` = `updatedAt` = that instant. |
| Success       | `201`, body the created `Transaction` (§2.1), including `title` and the server-set `date`.                                                                         |

| Status | `code`             | When                                       | `fieldErrors` keys                                          |
| :----- | :----------------- | :----------------------------------------- | :---------------------------------------------------------- |
| 400    | `VALIDATION_ERROR` | Body fails `CreateTransactionRequest` (§4) | any of `title`, `description`, `category`, `type`, `amount` |

### 5.3 `updateTransaction`: edit an existing transaction (full replace of the editable fields)

| Item          | Value                                                                                                                                                                   |
| :------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Method & path | `PUT /:id`                                                                                                                                                              |
| Auth          | Bearer                                                                                                                                                                  |
| Request body  | `UpdateTransactionRequest` (§2.5). A `date` key, if sent, is dropped (§1).                                                                                              |
| Effect        | Replaces `title`, `description`, `category`, `type` and `amount` on the caller's record and sets `updatedAt` to now. `date` and `createdAt` are left exactly as stored. |
| Success       | `200`, body the updated `Transaction` (§2.1). Its `date` equals the value it had before the call.                                                                       |

| Status | `code`             | When                                                                  | `fieldErrors` keys                                          |
| :----- | :----------------- | :-------------------------------------------------------------------- | :---------------------------------------------------------- |
| 400    | `VALIDATION_ERROR` | Body fails `UpdateTransactionRequest` (§4)                            | any of `title`, `description`, `category`, `type`, `amount` |
| 404    | `NOT_FOUND`        | `id` does not exist, or exists but belongs to another user (§1 Scope) | none                                                        |

### 5.4 `deleteTransaction`: permanently remove a transaction

Unchanged from v1.0.0.

| Item          | Value                                          |
| :------------ | :--------------------------------------------- |
| Method & path | `DELETE /:id`                                  |
| Auth          | Bearer                                         |
| Request       | No body                                        |
| Success       | `200`, body `DeleteTransactionResponse` (§2.6) |

| Status | `code`      | When                                                                  | `fieldErrors` keys |
| :----- | :---------- | :-------------------------------------------------------------------- | :----------------- |
| 404    | `NOT_FOUND` | `id` does not exist, or exists but belongs to another user (§1 Scope) | none               |

---

## 6. Operation Summary

| Operation           | Method & path                     | Auth   | Request                                | Success                         | Declared errors (besides 401/500)       |
| :------------------ | :-------------------------------- | :----- | :------------------------------------- | :------------------------------ | :-------------------------------------- |
| `getTransactions`   | `GET /api/v1/transactions`        | Bearer | `TransactionListQuery`                 | `200 TransactionListResponse`   | 400 `VALIDATION_ERROR`                  |
| `createTransaction` | `POST /api/v1/transactions`       | Bearer | `CreateTransactionRequest` (no `date`) | `201 Transaction`               | 400 `VALIDATION_ERROR`                  |
| `updateTransaction` | `PUT /api/v1/transactions/:id`    | Bearer | `UpdateTransactionRequest` (no `date`) | `200 Transaction`               | 400 `VALIDATION_ERROR`, 404 `NOT_FOUND` |
| `deleteTransaction` | `DELETE /api/v1/transactions/:id` | Bearer | none                                   | `200 DeleteTransactionResponse` | 404 `NOT_FOUND`                         |

Methods, paths, statuses and error codes are all unchanged from v1.0.0. Only shapes and rules change (§8).

---

## 7. Conflict Resolutions Made During Synthesis

The two fragments agree on the operations, the new `title` field, the removal of `date` from both request bodies, and the "date unchanged on update" rule. The points below were left open, stated differently, or in one case stale relative to the FDS. None of the resolutions adds a requirement the FDS does not already imply.

| #   | Topic                                                  | Frontend fragment                                                                                                                            | Backend fragment                                                                                                                                                      | Resolution and why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| :-- | :----------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C1  | Which day "today" is                                   | Mock `createTransaction` uses the current **local** date (§3); the E2E "today" assertion should use "the same timezone the server uses" (§7) | **UTC** calendar date of `clock.now()`, reusing the existing UTC `formatDate` helper (§4.2)                                                                           | **UTC** (§1). The FDS now says so literally (`fds.md` §2 `date` row, §5 `createTransaction`). This is staleness, not a disagreement: the frontend fragment was committed at 10:27:57 (+0545) in `5f1e5c2`; the FDS clarification that fixed UTC landed at 10:28:36 in `125752f`, and the backend fragment followed in `dac6167`. Any frontend mock and every E2E "today" check computes the date as the UTC calendar date. The frontend's date cell already formats with `timeZone: "UTC"`, so a stored date displays as the same day for every viewer. |
| C2  | `Title` rule details                                   | Required, 1–100, trimmed before the length check, messages `Title is required.` / `Title must be at most 100 characters.` (§2, §9)           | Mirror `Description` exactly: trim first, then 1–100; one message per failure in the same style (§6)                                                                  | **No conflict.** Both proposals are identical. Adopted as the `Title` rule set in §4, with the exact messages above. The FDS gives only "1–100 characters"; trimming matches how `Description` was already specified and built, so it is not a new requirement.                                                                                                                                                                                                                                                                                         |
| C3  | A `date` key in a create/update body                   | The frontend never sends one (§5 items 2–3)                                                                                                  | Silently dropped, like any unknown field, not rejected (§8 item 2)                                                                                                    | **Dropped silently** (§1). One policy for every not-accepted field, as v1.0.0 already had. It satisfies "never supplied by the client" (`fds.md` §2): the value never reaches the service. A `400` for it would be a new rule the FDS does not ask for.                                                                                                                                                                                                                                                                                                 |
| C4  | Titles for records created before v1.1.0               | Needs every record to carry a non-empty `title` that satisfies 1–100; how is a backend decision (§5 item 5)                                  | Migration backfills `SUBSTR(description, 1, 100)` verbatim, as the FDS specifies; flags two cosmetic edge cases (§2.2, §9 items 1–2)                                  | **Backfill as the FDS specifies, and record the two edge cases** (§2.1 note). The frontend's need is met: every record has a non-empty title. The only gap from "satisfies 1–100" is the rare astral-character case, which is bounded (only pre-1.1.0 rows with such characters in their first 100) and self-correcting on the next edit. Changing the formula (for example adding `RTRIM`) would deviate from the FDS text.                                                                                                                            |
| C5  | When the shared types change, relative to the frontend | Synthesizer must choose: contracts change before or alongside Frontend Build, or temporary local types plus a mock (§5 item 6)               | Contracts change is part of the backend work (§5.5, §12)                                                                                                              | **Backend Build runs first; Frontend Build runs after it, against the updated contract package.** This is a build-order decision and does not change any shape here. Rationale and gate details are in `plan.md` D-15 and §2.                                                                                                                                                                                                                                                                                                                           |
| C6  | Order of rows that tie on `date`                       | Relies on the v1.0.0 `createdAt` tie-break to put a new row at the top (§9)                                                                  | Ordering now depends almost entirely on `createdAt`; optional `id` final tie-break, recommended to leave out unless strict pagination stability is wanted (§9 item 3) | **Add `id` as the final tie-break** (§2.3). Under v1.1.0 every row created on the same UTC day shares one `date`, so ties on `date` are now the normal case, and rows created in the same millisecond also tie on `createdAt` (always so under a fixed test clock). Without a total order, `LIMIT`/`OFFSET` paging can repeat or skip such rows between pages. The cost is one more `ORDER BY` key. Starred for confirmation (`plan.md` D-22).                                                                                                          |
| C7  | Seeding E2E rows dated other than today                | Needs some E2E-only way to seed dated rows; suggests direct DB inserts or a test clock (§7, §9)                                              | Not addressed (E2E is out of backend scope)                                                                                                                           | **Not part of the API.** No seeding endpoint and no test clock hook are added to the production server. E2E seeds through the public operations only; date-window boundaries are proven at Unit/API level with the test clock (`plan.md` D-27).                                                                                                                                                                                                                                                                                                         |

---

## 8. Changes from v1.0.0

| Area                                     | v1.0.0                                              | v1.1.0                                                                         |
| :--------------------------------------- | :-------------------------------------------------- | :----------------------------------------------------------------------------- |
| `Transaction` (§2.1)                     | no `title`; `date` user-entered                     | `title` added; `date` read-only, server-set (UTC) at creation                  |
| Create/Update request bodies (§2.5)      | `date`, `description`, `category`, `type`, `amount` | `title`, `description`, `category`, `type`, `amount`; a sent `date` is dropped |
| Rule sets (§4)                           | `TransactionDate`                                   | `TransactionDate` removed; `Title` added                                       |
| `fieldErrors` keys for create/update     | `date`, `description`, `category`, `type`, `amount` | `title`, `description`, `category`, `type`, `amount`                           |
| List ordering (§2.3)                     | `date`, then `createdAt`                            | `date`, then `createdAt`, then `id`                                            |
| Methods, paths, statuses, error codes    | as listed                                           | unchanged                                                                      |
| `TransactionListQuery`, delete operation | as listed                                           | unchanged                                                                      |

---

## 9. Blocking Items for Plan Review

None. Every point of tension between the fragments was resolved from `fds.md` 1.1.0 as written, or as an internal choice that does not add an FDS requirement (§7). Choices the developer should confirm explicitly at the Approval Gate are starred (★) in `plan.md` §1.
