# Plan Review: transactions (v1.1.0)

- **Plan under review:** `features/transactions/plans/v1.1.0/plan.md` (first synthesis run, no revision header)
- **Contract under review:** `features/transactions/plans/v1.1.0/contract.md`
- **Specs:** `fds.md` 1.1.0, `behavior.md`, `visuals/*.png`
- **Directives:** none (`v1.1.0/directives.md` does not exist). This is a first review, so findings carry no origin label.
- **Reviewed:** 2026-10-04

## Verdict

**CHANGES REQUIRED**

There are two Blocking findings. Both are developer decisions. Neither is a spec defect, so the plan can be revised in place.

---

## Blocking Findings

### B-1 · Ledger date format: the plan contradicts itself and the visual spec

- **Where:** plan §4 FE-13 ("Date (already formatted with `timeZone: "UTC"`), amount and badge rendering are unchanged") vs. plan §6.2 T-UI-03 ("[regression] Date formatted `15 Oct 2025` style") vs. `visuals/transactions-page.png` (every Date cell reads `15 Oct 2025`).
- **Evidence:** `frontend/src/features/transactions/components/transaction-row.tsx` `formatDate` calls `toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })`. On this Node runtime that produces `Oct 15, 2025`, not `15 Oct 2025`.
- **Conditions:** **(c) Not executable** and **(a) Spec violation**.
  - (c): FE-13 keeps the rendering as it is, so the built ledger shows `Oct 15, 2025`. In Phase 8, the UI/E2E Test agent writes T-UI-03 from the plan and the visual, and the test fails against the planned code. The agent then has to choose between changing production code (a "defect" fix under `defects-ui-e2e.md`) and loosening a planned assertion. The plan does not settle that choice, so the run costs a Diagnosis loop.
  - (a): built as planned, the Date column differs from `visuals/transactions-page.png`. FE-13 already edits `transaction-row.tsx` and D-28 sends the ledger back through Phase 6, so this version touches the column anyway.
- The plan scopes out a similar pre-existing gap explicitly (D-25, Edit amount prefix) but does not mention this one.

### B-2 · "New record at the top of the table" fails when older rows are dated in the future

- **Where:** plan D-16, D-22 and BE-10 ordering (`date`, then `createdAt`, then `id`, descending under `newest`); contract §2.3; INT-05 ("Add creates a row dated with today's UTC date at the top of the default view"). Spec: `behavior.md` §2 step 3 ("the new record (dated today) is added to the top of the table").
- **Evidence:** v1.0.0 accepted any valid calendar date, with no future-date limit (`../v1.0.0/contract.md` §4 `TransactionDate`; the built `isValidCalendarDate` in `packages/contracts/src/transactions/transaction-validation.ts`). Migration `0003` keeps those dates (D-20). From 1.1.0 on, every new row is dated today (UTC). So any pre-1.1.0 row dated later in the current month sorts **above** a newly added row in the default `this_month` / `Newest First` view.
- **Conditions:** **(f) Silent ambiguity** and **(a) Spec violation**. The plan assumes that no stored row is dated after today. It never says so, and that assumption changes behavior `behavior.md` §2 defines. INT-05, which runs on a legacy-data database, fails as written if its seed data includes a future-dated row. The Integration agent may not change ordering logic ("Do not alter business logic"), so it would have to stop.
- This is the same kind of transitional legacy-data edge case as D-21, which the plan does star for the developer. This one is not recorded anywhere.

---

## Advisory Findings

### A-1 · D-15's "two expected frontend typecheck errors" will not happen at the locked versions

D-15, §2 step 1, BE-08 "Done when" and FE-11 "Done when" all expect BE-08 to cause two frontend typecheck errors in `api/transactions-api.ts`. It does not. Every request rule set in the contract package is written as `z.custom<unknown>().transform(...)`. With `zod@3.25.76` (`pnpm-lock.yaml`), `z.input` of such an object makes every key optional and of type `unknown`. ts-rest types the client request body as `ZodInputOrType<route.body>` (`@ts-rest/core@3.52.1`, `src/lib/infer-types.d.ts`). So a body that lacks `title` and still carries `date` still type-checks.

I confirmed this with a scratch `tsc --strict` check against the repository's zod: an object `{ date, description }` assigns to the input type of `z.object({ title: z.custom<unknown>().transform(...), description: ... })` with no error. Nothing else in `frontend/` imports a removed date export, so root `pnpm typecheck` stays green after BE-08 through BE-11.

The build order D-15 chooses still holds, because FE-11 (`Pick<Transaction, "title" | …>`) and FE-13 (`transaction.title`) need BE-08's `Transaction.title`. But the starred decision's stated consequence is wrong, and FE-11's "Done when" can never fail. Also note that typecheck gives no guarantee that the frontend sends `title` or omits `date`; T-UI-04 and T-UI-05 are the only guard. Fix the wording: expect zero frontend errors, and give FE-11 a real completion check, for example "the create and update request types include `title` and exclude `date`".

### A-2 · INT-05 does not say where its migration-0002 database comes from

INT-05 needs "a scratch copy of a database at migration `0002` that holds transactions from at least two users, including one with a description longer than 100 characters". No such database exists. `backend/data/app.db` is at migration 0002 but has 0 transactions. `backend/data/e2e-test.db` has no `transactions` table. Also, the developer database is at `backend/data/app.db`, not `data/app.db` as INT-05 writes. Name the method, for example: apply migrations through `0002` using the truncated-journal technique from T-UA-01, then seed through a throwaway script that uses `backend`'s own `better-sqlite3`. Alternatively, run the `1c226d9` backend in a separate worktree and seed through the API.

### A-3 · No test item for `api/transactions-api.ts`, and most of `transaction-error.ts` is untested

D-26 makes Phase 8 responsible for 90% coverage of `frontend/src/features/transactions/`. But every component test mocks `api/transactions-api.ts` with `vi.mock` (§6.2 header), and no test item covers `runOperation`: a success response that fails schema parsing becomes `unexpected`, a network failure becomes `unexpected`, and an error response is mapped. T-UI-14 covers only the `title` / `date` branches of `toTransactionFailure`. The not-found, unauthenticated, malformed-body and undeclared-status branches, which implement contract §1 "Undeclared outcomes", have no test. Adding one T-UI item that mocks `@/lib/api-client` lowers the risk of a Phase 8c coverage loop-back.

### A-4 · Some task traces do not cite an FDS section

FE-14 traces only to D-24. INT-06 traces to a fragment section and FE-14. FE-11 traces to the contract and D-15. All three are dead-code removal or verification tasks, so this is cosmetic. Adding the FDS section each one serves (for FE-14, `fds.md` §3 REQ-TXN-01 "There is no date control") would keep the matrix complete.

---

## Checklist Summary

| #   | Check                       | Result | Notes                                                                                                                                                                                         |
| :-- | :-------------------------- | :----- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Coverage                    | PASS   | Every 1.1.0 changelog item, REQ-TXN-01 through 04, §4, §5, every §6 AC and every `behavior.md` section maps to tasks or tests (§7 matrix checked against the spec text).                        |
| 2   | Traceability                | PASS   | Every task has a trace. A-4 covers three weak traces.                                                                                                                                         |
| 3   | Cross-section consistency   | FAIL   | B-1: FE-13 and T-UI-03 disagree on the date rendering. Field names, endpoints, bodies and error mapping (FE-10, T-UI-14, contract §5) otherwise agree.                                        |
| 4   | Rule compliance             | PASS   | No new libraries (D-27 avoids root `better-sqlite3`). Layering is kept. Contract types still come from `packages/contracts`.                                                                   |
| 5   | Testability                 | PASS   | Every requirement has Unit/API, component and/or E2E items. See A-3 for the coverage risk.                                                                                                    |
| 6   | Ambiguity carried forward   | FAIL   | B-2: assumes no stored row is dated after today. B-1: date-format gap against the visual is not addressed.                                                                                    |
| 7   | API Contract completeness   | PASS   | All four operations, shapes, rule sets, statuses and `fieldErrors` keys are specified. Plain prose with no ts-rest or Zod code. §8 gives a complete change list.                              |
| 8   | Executability               | FAIL   | B-1 forces an unplanned production-code-or-test decision in Phase 8. Otherwise executable: path ownership and test scopes are consistent; the drizzle 0.33 migrator applies `0003` alone after a truncated-journal run (`sqlite-core/dialect.js` compares `created_at` against the journal `when`); T-UA-01 is feasible. A-1 and A-2 are wording and setup gaps. |

---

## Suggested Next Step

Both Blocking Findings are **Developer decisions**. Neither is an obvious fix.

### B-1 · Ledger date format — DECISION NEEDED

- **Option A: match the visual (recommended).** Add to FE-13: `transaction-row.tsx` renders the Date cell as `15 Oct 2025` (day, short month, year, UTC). Build the string explicitly from a fixed month-abbreviation list, or with `formatToParts`. A bare `en-GB` locale renders September as `15 Sept 2025` on this Node runtime. Add the Date column to the D-28 Phase 6 review, and make T-UI-03 assert the exact string for at least one September date and one other month. *Trade-off:* a small UI change outside the strict 1.1.0 changelog, in a file FE-13 already edits, and it brings the ledger in line with its visual.
- **Option B: accept the built format.** Record a starred decision, like D-25, that the ledger keeps `Oct 15, 2025` (accepted at the v1.0.0 UI freeze), and rewrite T-UI-03 to assert that exact string. *Trade-off:* no code change, but a deviation from `visuals/transactions-page.png` stays on record.

### B-2 · New record versus future-dated legacy rows — DECISION NEEDED

- **Option A: accept and document (recommended).** Add a starred decision: under `Newest First`, a new row sits below any pre-1.1.0 row dated after today. This is transitional, because no new row can be dated later than today. Add the note to contract §2.3 and plan D-16. Reword INT-05 to "at the top of the default view, unless a legacy row is dated later than today", and have INT-05 seed one such row to confirm the documented order. *Trade-off:* a narrow, self-expiring deviation from `behavior.md` §2. If the developer wants the spec text to reflect it, that is a Clarification addendum to `behavior.md` (`rules/workflow.md` §4).
- **Option B: order by creation instead.** Change `newest`/`oldest` to order by `createdAt`, then `id`, ignoring `date`. *Trade-off:* the new row is always on top, but `Newest`/`Oldest` then reorder legacy rows by entry time instead of transaction date. That changes v1.0.0 D-07, contract §2.3, BE-10 and T-UA-02, and it is a visible behavior change for existing data.

### `directives.md` skeleton

Save as `features/transactions/plans/v1.1.0/directives.md` and fill in each `Decision`:

```text
# Directives: transactions v1.1.0

## B-1 Ledger date format (15 Oct 2025 vs built Oct 15, 2025)
Options considered: A) render `15 Oct 2025` in FE-13 (explicit month abbreviations, not bare en-GB), add Date to D-28, exact assertion in T-UI-03; B) keep `Oct 15, 2025` as a starred decision like D-25, T-UI-03 asserts the built format
Decision: <developer to fill in>
Apply to: FE-13, D-28, T-UI-03, §7 matrix (visuals row)
Record as a starred (★) decision in the plan's Decision Log: yes

## B-2 New record vs pre-1.1.0 rows dated after today
Options considered: A) accept and document: starred decision, contract §2.3 note, INT-05 reworded and seeded with a future-dated legacy row; B) order newest/oldest by createdAt then id, ignoring date
Decision: <developer to fill in>
Apply to: D-16 or a new decision, D-22, contract §2.3, BE-10, INT-05, T-UA-02, T-UI-09
Record as a starred (★) decision in the plan's Decision Log: yes
```

### Revision prompt

```text
Read the file .ai/prompts/plan/plan-synthesizer.md and follow it exactly. That is your system prompt.

Feature ID = transactions
Revision run. Plan Review (features/transactions/plans/v1.1.0/review.md) returned CHANGES REQUIRED.
Apply every decision in features/transactions/plans/v1.1.0/directives.md (B-1, B-2).
Also apply these advisory corrections from the same review:
- A-1: D-15, §2 step 1, BE-08 and FE-11 expect zero frontend typecheck errors after BE-08 (request
  input types are optional `unknown` at zod 3.25.76). Keep the build order; give FE-11 a real
  "Done when": the create and update request types include `title` and exclude `date`.
- A-2: INT-05 names how the migration-0002 database with two users' transactions is produced, and
  refers to backend/data/app.db, not data/app.db.
- A-3: add a T-UI item for api/transactions-api.ts (runOperation success, schema mismatch, network
  failure, error mapping) and extend T-UI-14 to every toTransactionFailure branch.
- A-4: add an FDS trace to FE-11, FE-14 and INT-06.
Revise plan.md and contract.md in place in v1.1.0/. Do not change other sections.
```

After the revision, run Plan Review again in a new session.
