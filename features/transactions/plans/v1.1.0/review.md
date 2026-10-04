# Plan Review: transactions (v1.1.0)

- **Plan under review:** `plan.md` (Revision 1, 2026-10-04) and `contract.md` (Revision 1), same directory
- **Specs:** `fds.md` 1.1.0, `behavior.md`, `visuals/*.png` (6 files)
- **Directives:** `directives.md` (B-1, B-2). Both are settled and were not reopened.
- **Re-review:** yes. This is review 2 of this version; the previous report was archived to `reviews/r1.md` unread.
- **Finding IDs** continue after the IDs the plan header already cites (B-1, B-2, A-1 to A-4), so new IDs start at B-3 and A-5.
- **Reviewed:** 2026-10-04

---

## Verdict

**CHANGES REQUIRED**

There is one Blocking finding. It sits in text that Revision 1 rewrote (INT-05). The rest of the plan is sound. Coverage, traceability, the contract, the rule checks and the test list all pass. The build-order claim in D-15 holds at the locked versions (see Checklist 8).

---

## Blocking Findings

### B-3 · INT-05 makes the Integration agent work outside the repository

- **Plan section:** §5 INT-05, the "Scratch database" steps 1–4 and the step after them ("Start the current backend with `DATABASE_PATH` pointing at `<scratch-dir>/int05.db`"). §2 step 4 limits Integration to `frontend/**` and `backend/**`.
- **Conflicts with:** `.ai/prompts/build-mode.md`, Context & Rules: "Work strictly within the current project repository. Never inspect, reference, copy, or modify anything outside it." Integration runs under that prompt (`rules/workflow.md` §2 Phase 7; `CLAUDE.md` Phase 7).
- **Condition:** (c) Not executable.
- **Concrete failure:** INT-05 tells the agent to run `git worktree add <scratch-dir>/transactions-1c226d9 1c226d9`, "where `<scratch-dir>` is outside the repository", then run `pnpm install` there, start that checkout's backend, and write `<scratch-dir>/int05.db`. It then starts the current backend against that outside file. Every one of those steps creates, changes or reads files outside the repository. An Integration agent that obeys its system prompt has to stop at INT-05 step 1 and escalate. The alternative is to break its boundary. Directive B-2 depends on INT-05 to check the future-dated legacy row in the real product, so this step cannot be skipped.
- **Secondary gap in the same step:** step 2 starts the worktree's backend "with the developer's usual backend environment". The worktree is a fresh checkout, and `.env` is git-ignored (`.gitignore`). `backend/src/index.ts` loads the environment through `process.loadEnvFile`, and `loadConfig` throws without `JWT_SECRET`. The plan does not say where the worktree backend gets its `JWT_SECRET`. Copying `backend/.env` into the worktree, or passing `JWT_SECRET` inline, would close this. The fix for B-3 should state which one.
- **Origin:** `Revision`. INT-05's database-production steps are the text the plan header lists as changed under A-2 in Revision 1. The future-dated seed row came from directive B-2.
- **Classification:** Developer decision. See Suggested Next Step.

---

## Advisory Findings

- **A-5 · §2 step 3 still says "the three deltas only (D-28)".** D-28 now lists four review items: the Add first field, the Edit first field, the seven-column ledger, and the Date cell format added by directive B-1 (D-29). The table row disagrees with the decision it cites. Phase 6 is a human review that reads D-28, so nothing breaks, but the row should say "the four deltas". (Revision text.)
- **A-6 · Some per-task typechecks will fail before the next task runs.** `build-mode.md` runs lint and typecheck after every item, with 3 attempts. BE-08's done-when says the filtered typecheck passes only once BE-10 and BE-11 are done, which is right. BE-09 and FE-10 have the same property but do not say so. After BE-09, `transaction-repository.ts` `create` lacks the now-required `title`. After FE-10, both dialogs still call `watch("date")` and pass `dateValue`, and FE-12 is what removes those. The agent can resolve this inside its own scope by doing the next task, so this is not blocking. A one-line note on BE-09 and FE-10 ("typecheck is green again after BE-10 / FE-12") would stop the agent from spending retry attempts on it.
- **A-7 · BE-09's "the generated snapshot matches the Drizzle schema" has no named check.** Suggest stating the check: after the hand edit, run `pnpm --filter backend db:generate` again and confirm it reports no schema changes and creates no `0004` file.
- **A-8 · The `Title` rule does not say what happens to a present but non-string value.** An example is `"title": 5`. Contract §4 says "empty after trim (or missing) → `Title is required.`" but does not cover other types. The built `Description` rule maps non-strings to `""` (`asText`), so they get the "required" message, and BE-08 says to write `transactionTitleSchema` "in the same style". Both sides use the same contract package, so Frontend and Backend cannot diverge. The frontend always sends strings, so users cannot see the difference. For completeness, contract §4 could add "(or not a string)" to rule 1, the same wording `Amount` uses.

---

## Checklist Summary

| #   | Point                         | Result | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| :-- | :---------------------------- | :----- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Coverage                      | PASS   | Each 1.1.0 changelog item, REQ-TXN-01–04, §4, §5, all seven §6 criteria and `behavior.md` §1–§4 map to tasks or regression tests (§7 matrix, checked against the spec text).                                                                                                                                                                                                                                                                                                                  |
| 2   | Traceability                  | PASS   | Every BE, FE and INT task and every T-UA and T-UI row cites an FDS section, REQ ID or decision.                                                                                                                                                                                                                                                                                                                                                                                               |
| 3   | Cross-section consistency     | PASS   | Field set, the dropped `date`, the `title` rule and the ordering keys agree across §3–§6 and the contract. One wording slip is noted in A-5.                                                                                                                                                                                                                                                                                                                                                   |
| 4   | Rule compliance               | PASS   | No new library; layering is unchanged; D-27 avoids adding `better-sqlite3` at the root; types come from the contract package.                                                                                                                                                                                                                                                                                                                                                                 |
| 5   | Testability                   | PASS   | Each implementation task has a test row. The migration (T-UA-01), the UTC date (T-UA-04), the dropped `date` (T-UA-06, T-UA-07), the `id` tie-break and D-30 (T-UA-02), the Date format (T-UI-03) and request bodies (T-UI-04, T-UI-05, T-UI-15) all have tests.                                                                                                                                                                                                                             |
| 6   | Ambiguity carried forward     | PASS   | UTC "today" (D-16), the backfill edge cases (D-20, D-21), legacy future dates (D-30), the Edit amount prefix (D-25) and the Date format (D-29) are all written decisions, starred where they involve a choice.                                                                                                                                                                                                                                                                                 |
| 7   | API contract completeness     | PASS   | All four operations, the shapes, the rule sets with exact messages, the statuses, the `fieldErrors` keys and the ordering are specified. The contract is plain prose with no framework code. A-8 is a cosmetic gap only.                                                                                                                                                                                                                                                                     |
| 8   | Executability                 | FAIL   | B-3. The rest was verified: `pnpm --filter @workflow-demo/contracts --filter backend` resolves both packages. The D-15 claim holds: at `@ts-rest/core@3.52.1` the client body is `ZodInputOrType` (`src/lib/infer-types.d.ts`), the input of a `z.custom<unknown>()` field is optional `unknown` at `zod@3.25.76`, and no frontend file imports a removed date export. T-UA-01's cut-journal approach works with the drizzle migrator, which applies migrations whose `folderMillis` is greater than the last stored `created_at`. `TestClock`, `startTestApp` and `sendRequest` exist as cited. |

---

## Outside Plan Scope

- `playwright.config.ts` sets `reuseExistingServer: !process.env.CI`. Outside CI, a backend already running on port 4000 is reused, so E2E can run against that server's database (for example `app.db`) instead of `data/e2e-test.db`.

---

## Suggested Next Step

The retry bound is not reached: this is the plan's first revision cycle. The header shows Revision 1.

### 1. Classification

**B-3: Developer decision. `DECISION NEEDED`.** Two options are valid. Directive B-2 is settled, so INT-05 must keep a hands-on check of a migrated `0002` database that holds a future-dated legacy row.

- **Option A (recommended): keep the worktree approach, but inside `backend/`.**
  - Worktree at `backend/data/int05-worktree` (`git worktree add backend/data/int05-worktree 1c226d9`), then `pnpm install` inside it.
  - The worktree backend gets its `JWT_SECRET` from the developer's `backend/.env`, copied into the worktree's `backend/` or passed inline.
  - The database is `backend/data/int05.db`, which `*.db` in `.gitignore` already ignores. The current backend runs against that same file.
  - Order at the end: remove the worktree (step 4) and delete `int05.db` and its `-shm` and `-wal` files, then run root `pnpm lint`, `pnpm typecheck` and `pnpm test`. While the worktree exists, `eslint .` and backend Vitest would scan its files.
  - *Trade-off:* the step stays fully automated and inside Integration's `backend/**` scope. A second full checkout sits under `backend/` for a while, so the removal order is load-bearing.
- **Option B: the developer produces the `0002` database before Integration.**
  - Move steps 1–4 into a "Before you start" step for the developer, who is not bound by the agent's path rules. The output is a file at `backend/data/int05.db` with the seeded users and rows, including the future-dated one.
  - INT-05 then starts from that file and only runs the checks.
  - *Trade-off:* the agent's steps get simpler and touch no git state. A manual setup step is added, and the agent cannot check how the seed data was made.

### 2. Revision prompt

Fill in `directives.md` first (step 3 below), then paste:

```text
Read the file .ai/prompts/plan/plan-synthesizer.md and follow it exactly. That is your system prompt.

Feature ID = transactions
Revision run. Plan Review (features/transactions/plans/v1.1.0/review.md) returned CHANGES REQUIRED.
Apply decision B-3 in features/transactions/plans/v1.1.0/directives.md (INT-05 scratch database location);
directives B-1 and B-2 stay as already applied.
Also apply these advisory fixes from the review:
- A-5: plan.md §2 step 3 says "the four deltas only (D-28)".
- A-6: BE-09 and FE-10 note that the per-task typecheck goes green again after BE-10 / FE-12.
- A-7: BE-09 done-when adds: re-run `pnpm --filter backend db:generate` and confirm it reports no schema changes.
- A-8: contract.md §4 Title rule 1 reads "empty after trim, missing, or not a string → Title is required."
Revise plan.md and contract.md in place. Do not change other sections.
```

### 3. `directives.md` skeleton (append to the existing file)

```markdown
## B-3 INT-05 scratch database outside the repository

Options considered: A) worktree at backend/data/int05-worktree, DB at backend/data/int05.db, JWT_SECRET from backend/.env, worktree and DB removed before the root gates; B) developer produces backend/data/int05.db (0002 schema, seeded users and legacy rows incl. one future-dated row) before Integration, INT-05 only verifies
Decision: <developer to fill in>
Apply to: INT-05, §2 step 4 (and the Integration "Before you start" if B)
Record as a starred (★) decision in the plan's Decision Log: <developer to fill in>
```
