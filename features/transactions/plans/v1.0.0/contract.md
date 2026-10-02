# API Contract: transactions (v1.0.0)

- **Feature:** `transactions` (Transactions Management)
- **FDS version:** 1.0.0 (`features/transactions/fds.md`, changelog entry 1.0.0 dated 2026-09-22, addended to close the `timeframe` enum)
- **Produced by:** Plan Synthesizer, from `fragments/frontend.md` §5 and `fragments/backend.md` §5
- **Status:** Draft. Frozen at the Developer Approval Gate (Phase 4). After that, Frontend Build, Backend Build and Integration build against this file as written. Neither side may edit it.
- **Companion plan:** `plan.md` (same directory)

This document is the only source of truth for the Frontend/Backend interface of `transactions`. It is plain language on purpose and does not assume any framework. Turning it into the project's typed contract package is a Backend Build task (see `plan.md`, task BE-02).

`transactions` depends on `auth` and `profile` (`features/index.json`). Every operation below reuses the authentication mechanism and the shared `ErrorBody`/error-code catalog already defined in `features/auth/plans/v1.0.0/contract.md` (§2.5, §3, §9) rather than redefining them. No operation here depends on `profile` at the API level — `profile` is a dependency only because the frontend's amount-field currency symbol is derived from the signed-in user's `preferredCurrency` (already available via the existing `useProfile()` query), never from a transactions endpoint (see `plan.md` Decision Log D-04).

---

## 1. General Conventions

| Topic                              | Rule                                                                                                                                                                                                                                                                                                      |
| :--------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base path                          | Every operation is served under `/api/v1/transactions`. Paths below are relative to it (for example `/:id` means `/api/v1/transactions/:id`).                                                                                                                                                             |
| Body format                        | Request and response bodies are JSON (`Content-Type: application/json`).                                                                                                                                                                                                                                  |
| Unknown / not-accepted body fields | Ignored — never cause an error, never applied, never echoed back (same convention as `auth`/`profile`). In particular, `id`, `userId`, `createdAt`, `updatedAt` sent on a create/update request are silently ignored.                                                                                     |
| Auth                               | Every operation requires `Authorization: Bearer <accessToken>`, exactly as `features/auth/plans/v1.0.0/contract.md` §9 defines. A missing, malformed, invalid or expired token returns `401 UNAUTHENTICATED` with the shared `ErrorBody` shape.                                                           |
| Scope                              | Every operation reads and writes only transactions owned by the user identified by the access token. A transaction id that exists but belongs to a different user behaves identically to a non-existent id (`404 NOT_FOUND`) — never `403`, never a silent cross-user read (`plan.md` Decision Log D-02). |
| Timestamps                         | `date` is a plain `YYYY-MM-DD` calendar date with no time component. `createdAt` / `updatedAt` on `Transaction` are ISO-8601 UTC timestamp strings.                                                                                                                                                       |
| Undeclared outcomes                | The client treats any status or `code` not declared for an operation (including network failure and any `5xx`) as "unexpected" and applies a generic failure message. The server never returns a `2xx` other than the one declared per operation.                                                         |

---

## 2. Shared Shapes

### 2.1 `Transaction` (`fds.md` §2)

| Field         | Type                      | Notes                                                                                                                                                                               |
| :------------ | :------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | UUID string               | Primary key, generated server-side.                                                                                                                                                 |
| `date`        | string (`YYYY-MM-DD`)     | Required.                                                                                                                                                                           |
| `description` | string                    | 1–255 characters.                                                                                                                                                                   |
| `category`    | enum (10 values, §2.4)    | Required. Independent of `type` — no category implies a fixed type (confirmed by `fragments/frontend.md` §4 item 4, e.g. `investment` can be an `expense`).                         |
| `type`        | `"income"` \| `"expense"` | Required. Carries the sign; `amount` itself is always positive.                                                                                                                     |
| `amount`      | number                    | Always positive (`> 0`); sign/currency symbol are a display-only concern layered on top by the frontend, not part of the stored or transmitted value (`plan.md` Decision Log D-03). |
| `createdAt`   | ISO timestamp string      | Record creation.                                                                                                                                                                    |
| `updatedAt`   | ISO timestamp string      | Last update to any editable field.                                                                                                                                                  |

`userId` is never part of this shape — it is an internal ownership column, the same pattern `user_profiles.user_id` already uses (never exposed on `UserProfile`).

### 2.2 `TransactionListQuery` (query params of `getTransactions`)

| Field       | Type                                                             | Required | Default                 | Notes                                                                                                                                                  |
| :---------- | :--------------------------------------------------------------- | :------- | :---------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page`      | integer ≥ 1                                                      | No       | `1`                     |                                                                                                                                                        |
| `limit`     | integer, `1`–`100`                                               | No       | `10`                    | Fixed named constants (`DEFAULT_LIMIT = 10`, `MAX_LIMIT = 100`) — resolved at synthesis; neither fragment nor `fds.md` names a concrete value (§7 C2). |
| `category`  | one of the 10 values in §2.4                                     | No       | absent = "All Category" |                                                                                                                                                        |
| `type`      | `"income"` \| `"expense"`                                        | No       | absent = "All Types"    |                                                                                                                                                        |
| `timeframe` | `"this_week"` \| `"this_month"` \| `"this_year"` \| `"all_time"` | No       | `"this_month"`          | Closed enum per `fds.md` REQ-TXN-04 / §5 addendum. **No `"today"` value** (§7 C1).                                                                     |
| `sort`      | `"newest"` \| `"oldest"`                                         | No       | `"newest"`              | `"newest"` = descending by `date`; `"oldest"` = ascending by `date`.                                                                                   |

### 2.3 `TransactionListResponse` (body of `getTransactions` on success)

| Field   | Type            | Notes                                                                                                                                                                                                        |
| :------ | :-------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data`  | `Transaction[]` | The requested page, ordered by `sort`, then by `createdAt` as a deterministic tie-break for rows sharing the same `date` (§7 C4): `createdAt DESC` under `"newest"`, `createdAt ASC` under `"oldest"`.       |
| `total` | integer         | Count of all transactions matching `category`/`type`/`timeframe` (unpaginated) — always consistent with the filter that produced `data`, never the unfiltered table total. Drives the frontend's page count. |

### 2.4 `category` enum (`fds.md` §2)

`"food_and_dining"`, `"salary"`, `"transportation"`, `"shopping"`, `"investment"`, `"freelance_work"`, `"bills_and_utilities"`, `"health_and_fitness"`, `"savings_account"`, `"others"`.

### 2.5 `CreateTransactionRequest` (body of `createTransaction`) / `UpdateTransactionRequest` (body of `updateTransaction`)

Identical field set — `updateTransaction` is a full replace of the editable fields, not a partial patch, matching the Edit modal's fully pre-filled form (`behavior.md` §3; `plan.md` Decision Log D-01):

| Field         | Type   | Rule set (§4)     |
| :------------ | :----- | :---------------- |
| `date`        | string | `TransactionDate` |
| `description` | string | `Description`     |
| `category`    | string | `Category`        |
| `type`        | string | `Type`            |
| `amount`      | number | `Amount`          |

### 2.6 `DeleteTransactionResponse` (body of `deleteTransaction` on success)

| Field     | Type        | Notes                         |
| :-------- | :---------- | :---------------------------- |
| `success` | boolean     | Always `true`.                |
| `id`      | UUID string | The id of the deleted record. |

---

## 3. Error Code Catalog

No new error codes. `transactions` reuses exactly three codes from the shared catalog (`packages/contracts/src/common/error-body.ts`), unchanged:

| Code               | Status | Meaning here                                                                                      |
| :----------------- | :----- | :------------------------------------------------------------------------------------------------ |
| `VALIDATION_ERROR` | 400    | Request body or query params fail §4/§2.2's rules.                                                |
| `UNAUTHENTICATED`  | 401    | Missing/invalid/expired access token.                                                             |
| `NOT_FOUND`        | 404    | `updateTransaction`/`deleteTransaction` target id does not exist, or belongs to a different user. |

Every operation below may also return `500 INTERNAL_ERROR`; not repeated per operation.

---

## 4. Shared Validation Rule Sets

| Rule set          | Field(s)      | Rules in order → message                                                                                                       |
| :---------------- | :------------ | :----------------------------------------------------------------------------------------------------------------------------- |
| `TransactionDate` | `date`        | 1. empty → `Date is required.` 2. not a valid `YYYY-MM-DD` calendar date → `Enter a valid date.`                               |
| `Description`     | `description` | 1. empty (after trim) → `Description is required.` 2. more than 255 characters → `Description must be at most 255 characters.` |
| `Category`        | `category`    | 1. empty → `Category is required.` 2. not one of the 10 values in §2.4 → `Select a valid category.`                            |
| `Type`            | `type`        | 1. empty → `Type is required.` 2. not `"income"`/`"expense"` → `Select a valid type.`                                          |
| `Amount`          | `amount`      | 1. empty/not a number → `Amount is required.` 2. `amount <= 0` → `Amount must be greater than 0.`                              |
| `Page`            | `page`        | 1. present and not an integer ≥ 1 → `Page must be a positive integer.`                                                         |
| `Limit`           | `limit`       | 1. present and not an integer in `1`–`100` → `Limit must be between 1 and 100.`                                                |
| `CategoryFilter`  | `category`    | 1. present and not one of the 10 values in §2.4 → `Select a valid category.`                                                   |
| `TypeFilter`      | `type`        | 1. present and not `"income"`/`"expense"` → `Select a valid type.`                                                             |
| `Timeframe`       | `timeframe`   | 1. present and not one of `"this_week"`/`"this_month"`/`"this_year"`/`"all_time"` → `Select a valid timeframe.`                |
| `Sort`            | `sort`        | 1. present and not `"newest"`/`"oldest"` → `Select a valid sort order.`                                                        |

**Composed request rule sets:**

| Composed set               | Fields → rule set                                                                                                        | Used by             |
| :------------------------- | :----------------------------------------------------------------------------------------------------------------------- | :------------------ |
| `CreateTransactionRequest` | `date`→`TransactionDate`; `description`→`Description`; `category`→`Category`; `type`→`Type`; `amount`→`Amount`           | `createTransaction` |
| `UpdateTransactionRequest` | identical to `CreateTransactionRequest` — all five fields required (D-01)                                                | `updateTransaction` |
| `TransactionListQuery`     | `page`→`Page`; `limit`→`Limit`; `category`→`CategoryFilter`; `type`→`TypeFilter`; `timeframe`→`Timeframe`; `sort`→`Sort` | `getTransactions`   |

---

## 5. Operations

### 5.1 `getTransactions` — list the caller's transactions, paginated and filtered

| Item          | Value                                        |
| :------------ | :------------------------------------------- |
| Method & path | `GET /` (i.e. `GET /api/v1/transactions`)    |
| Auth          | Bearer                                       |
| Request       | Query: `TransactionListQuery` (§2.2)         |
| Success       | `200`, body `TransactionListResponse` (§2.3) |

| Status | `code`             | When                                              | `fieldErrors` keys                                              |
| :----- | :----------------- | :------------------------------------------------ | :-------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR` | Any query param fails `TransactionListQuery` (§4) | any of `page`, `limit`, `category`, `type`, `timeframe`, `sort` |

### 5.2 `createTransaction` — add a new income or expense record

| Item          | Value                                        |
| :------------ | :------------------------------------------- |
| Method & path | `POST /`                                     |
| Auth          | Bearer                                       |
| Request body  | `CreateTransactionRequest` (§2.5)            |
| Success       | `201`, body the created `Transaction` (§2.1) |

| Status | `code`             | When                                       | `fieldErrors` keys                                         |
| :----- | :----------------- | :----------------------------------------- | :--------------------------------------------------------- |
| 400    | `VALIDATION_ERROR` | Body fails `CreateTransactionRequest` (§4) | any of `date`, `description`, `category`, `type`, `amount` |

### 5.3 `updateTransaction` — edit an existing transaction (full replace of the editable fields)

| Item          | Value                                        |
| :------------ | :------------------------------------------- |
| Method & path | `PUT /:id`                                   |
| Auth          | Bearer                                       |
| Request body  | `UpdateTransactionRequest` (§2.5)            |
| Success       | `200`, body the updated `Transaction` (§2.1) |

| Status | `code`             | When                                                                      | `fieldErrors` keys                                         |
| :----- | :----------------- | :------------------------------------------------------------------------ | :--------------------------------------------------------- |
| 400    | `VALIDATION_ERROR` | Body fails `UpdateTransactionRequest` (§4)                                | any of `date`, `description`, `category`, `type`, `amount` |
| 404    | `NOT_FOUND`        | `id` does not exist, or exists but belongs to a different user (§1 Scope) | —                                                          |

### 5.4 `deleteTransaction` — permanently remove a transaction

| Item          | Value                                          |
| :------------ | :--------------------------------------------- |
| Method & path | `DELETE /:id`                                  |
| Auth          | Bearer                                         |
| Request       | No body                                        |
| Success       | `200`, body `DeleteTransactionResponse` (§2.6) |

| Status | `code`      | When                                                                      | `fieldErrors` keys |
| :----- | :---------- | :------------------------------------------------------------------------ | :----------------- |
| 404    | `NOT_FOUND` | `id` does not exist, or exists but belongs to a different user (§1 Scope) | —                  |

---

## 6. Operation Summary

| Operation           | Method & path                     | Auth   | Request                    | Success                         | Declared errors (besides 401/500)       |
| :------------------ | :-------------------------------- | :----- | :------------------------- | :------------------------------ | :-------------------------------------- |
| `getTransactions`   | `GET /api/v1/transactions`        | Bearer | `TransactionListQuery`     | `200 TransactionListResponse`   | 400 `VALIDATION_ERROR`                  |
| `createTransaction` | `POST /api/v1/transactions`       | Bearer | `CreateTransactionRequest` | `201 Transaction`               | 400 `VALIDATION_ERROR`                  |
| `updateTransaction` | `PUT /api/v1/transactions/:id`    | Bearer | `UpdateTransactionRequest` | `200 Transaction`               | 400 `VALIDATION_ERROR`, 404 `NOT_FOUND` |
| `deleteTransaction` | `DELETE /api/v1/transactions/:id` | Bearer | none                       | `200 DeleteTransactionResponse` | 404 `NOT_FOUND`                         |

---

## 7. Conflict Resolutions Made During Synthesis

The two fragments agreed on routes, methods, the `Transaction` shape, and the overall CRUD behavior. These points were left open, implied differently, or in one case genuinely stale relative to the FDS, and were resolved as follows. Per the Plan Synthesizer's mandate, nothing here invents a requirement the FDS does not already imply.

| #   | Topic                                                       | Frontend fragment                                                                                                                                                    | Backend fragment                                                                                                                                                                              | Resolution and why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| :-- | :---------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | `timeframe` allowed values                                  | Proposed 5 values for its mocks: `today`, `this_week`, `this_month`, `this_year`, `all_time` (fragment §3, §5, §9)                                                   | Grounded in `fds.md`'s now-closed enum: `this_week`, `this_month`, `this_year`, `all_time` — 4 values, no `today` (fragment §0)                                                               | **Adopted the backend's 4-value enum, as `fds.md` REQ-TXN-04 / §5 now literally states it.** `activity-log.md` shows the Frontend Fragment and the Backend Fragment's first (stopped) attempt both ran at `08:58:32Z`, before `fds.md` was addended; the Backend Fragment's second attempt (`09:00:00Z`) and the addendum both post-date it. This is staleness, not a genuine disagreement about intent — the FDS is authoritative once amended. The Timeframe select renders exactly four options (This Week / This Month / This Year / All Time), default "This Month"; no "Today" option exists in Build.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| C2  | `limit` default and maximum                                 | Proposed `10` as a build-time default for mocks/pagination UI, not specified by `fds.md` (fragment §4, §9)                                                           | Flagged as an open item; recommended fixing a concrete default and maximum as named constants (fragment §5.1, §9 item 1)                                                                      | **Fixed as named constants: `DEFAULT_LIMIT = 10`, `MAX_LIMIT = 100`** (§2.2). Matches the frontend's own build-time assumption and the backend's recommended pattern; no FDS text contradicts a specific number, so this is an implementation default, not an invented requirement.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| C3  | `sort` wire values                                          | Builds mocks with `"newest"` / `"oldest"` (fragment §3)                                                                                                              | Chose `"newest"` / `"oldest"` to match `behavior.md`'s "Newest First"/"Oldest First" labels, flagged for the Synthesizer to confirm if the frontend diverged (fragment §5.1, §9 item 2)       | **No conflict — both fragments already agree on `"newest"`/`"oldest"`.** Confirmed as the final wire values; no reconciliation needed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| C4  | `"this_week"` start-of-week convention                      | Not addressed                                                                                                                                                        | Flagged as unresolved; isolated the computation in the Service layer so the convention can be confirmed at Build without touching the Repository or route contract (fragment §4.1, §9 item 3) | ★ **Resolved as the ISO-8601 Monday-start week**: the 7-day window from the most recent Monday 00:00:00 (inclusive) through the following Monday 00:00:00 (exclusive), evaluated against `clock.now()`. This does not change any declared request/response shape — only the Service-layer date math behind `timeframe=this_week` — so it is not a blocking contract gap, but it is a real behavioral choice neither spec states; flagged for explicit developer confirmation at the Approval Gate (`plan.md` Decision Log, same pattern as `profile`'s D-17 rate-limit-window boundary).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| C5  | Tie-break ordering for same-`date` rows                     | Not addressed                                                                                                                                                        | Proposed as the repository's own choice, flagged for one-line confirmation at Synthesis (fragment §3, §9 item 4)                                                                              | **Adopted as the backend proposed, made explicit in the contract (§2.3): `createdAt DESC` under `sort=newest`, `createdAt ASC` under `sort=oldest`.** Keeps pagination deterministic and stable; low-risk, does not change any declared shape.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| C6  | Currency symbol for the Amount field's sign/currency prefix | Assumed reuse of "the exact mapping already established by `profile`" — `read-only-preferences-list.tsx`'s `CURRENCY_SYMBOLS` (fragment §4 item 5)                   | Not addressed (currency display is explicitly out of backend scope, fragment §1)                                                                                                              | **Verified during synthesis that `CURRENCY_SYMBOLS` is a private, unexported `const` in `frontend/src/features/profile/components/read-only-preferences-list.tsx` — literal reuse as the frontend fragment assumed is not currently possible without either duplicating the map (violates `rules/conventions.md` "Avoid duplicated logic") or exporting it.** Resolution: a new shared module `frontend/src/lib/currency.ts` exports `CURRENCY_SYMBOLS` (keyed by `UserProfile["preferredCurrency"]`); `profile`'s `read-only-preferences-list.tsx` is updated to import from it instead of defining its own copy — a purely additive relocation with no behavioral or visual change to the already-frozen `profile` feature. `transactions` imports the same shared constant. Same category of touch as `profile`'s own plan made to `auth`'s frozen `UserRepository` (that plan's D-12): additive, non-breaking, and scoped entirely inside `frontend/`, so it does not cross Build Mode's path boundaries (`plan.md` BE/FE split; `CLAUDE.md` "Strict path boundaries"). |
| C7  | Edit / Delete success & failure toast copy                  | Proposed specific copy for all four (not literally specified by `fds.md`/`behavior.md`, which only give Add's copy verbatim), flagged non-blocking (fragment §4, §9) | Not addressed (toast copy is a frontend-only concern)                                                                                                                                         | **Adopted the frontend's proposed copy** (`plan.md` FE section) since both specs confirm _that_ a toast occurs for Edit and Delete — only the exact wording was open, the same category of gap `profile`'s synthesis resolved non-blocking for its own dialogs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

---

## 8. Blocking Items for Plan Review

None. Every point of tension between the fragments was resolvable either directly from `fds.md`/`behavior.md` as already written, or as a non-blocking internal implementation choice that changes no declared request/response shape (§7 C4, C5) — without inventing a requirement neither document implies. The one genuinely new engineering decision (§7 C6, the `CURRENCY_SYMBOLS` relocation) is additive and scoped to `frontend/`, not a contract change. Choices the developer should explicitly confirm at the Approval Gate are starred (★) in `plan.md` §1 (Decision Log).
