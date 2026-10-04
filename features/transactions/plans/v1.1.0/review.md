# Plan Review: transactions (v1.1.0)

- **Reviewed:** `plan.md` (Revision 5, 2026-10-04) and `contract.md` (Revision 4, 2026-10-04)
- **Against:** `fds.md` 1.1.0, `behavior.md`, `visuals/*.png` (all six), `directives.md` (B-1 to B-7 and both retry-bound authorizations), `rules/architecture.md`, `rules/conventions.md`, `rules/tech-stack.md`, `rules/workflow.md`, `features/index.json`, `.ai/prompts/build-mode.md`, `.ai/prompts/test-build-mode.md`
- **Re-review:** yes (directives exist; the plan header records 5 revisions). `reviews/` was not read.
- **Date:** 2026-10-04 12:17 +0545

## Verdict

**PASS**

No finding meets a Blocking condition (a)–(f). The Advisory Findings below are worth fixing in place, or noting at the Approval Gate, but none blocks approval.

---

## Blocking Findings

None.

---

## Advisory Findings

**A-1 · FE-11's completion check contradicts FE-10's typecheck note.** FE-11 "Done when" ends with "root `pnpm typecheck` stays green". FE-10's typecheck note says root typecheck goes red at FE-10 (both dialogs still call `watch("date")` and pass `dateValue`) and turns green again only after FE-12. FE-11 runs inside that window. FE-11 clears only the `CreateTransactionRequest` mismatch, so the dialog errors are still there when FE-11 finishes. The FE-10 note tells the agent not to spend retries before FE-12, so the build is not blocked. The fix is wording only: FE-11 should say "the request-type error from FE-10 clears; the remaining dialog errors clear at FE-12".

**A-2 · FE-15 does not say where the icon colour class goes; T-UI-17 assumes it is on the `svg`.** FE-15 says "a leading `CheckCircleIcon` in `text-green-500`" (and `AlertCircleIcon` in `text-red-500`). T-UI-17 asserts "an `svg` with class `text-green-500`" / "`text-red-500`". If Frontend Build puts the colour on a wrapping `<span>`, the rendered colour is identical (the icon fills with `currentColor`), but the T-UI-17 assertion fails and the UI/E2E agent has to retarget it. Suggested wording for FE-15: pass the colour through the icon's `className` (for example `<CheckCircleIcon className="h-5 w-5 shrink-0 text-green-500" />`), the same way `CloseIcon` already takes its classes.

**A-3 · INT-05 gives no way to make its UI checks.** INT-05 asks the Integration agent to confirm UI facts in a local run: the Title column shows for legacy rows, a legacy row opens in Edit pre-filled and saves, a new row appears at the top of the default view (or below the future-dated legacy row), and the Date cell stays the same after an edit. INT-05 says "Files: none expected" and names no method. The data facts (backfill, stored `date`, ordering) can be checked through the API. The visual facts need a browser. A Claude Code session usually has a browser tool, so the agent can choose a method within its own scope, and the choice affects no other phase or the contract. Suggestion: name the method, for example "verify through the API, and check the ledger and Edit dialog in a browser (browser tool, or the developer confirms)". Also say that no scratch Playwright script is left in the tree.

**A-4 · T-UI-16's fake-timer recipe leaves out the Testing Library interaction.** `frontend/vitest.config.ts` does not enable Vitest globals, so `@testing-library/react` does not detect Vitest's fake timers (it only auto-advances Jest's). Its `waitFor` / `findBy*` polling then depends on timers that `vi.useFakeTimers()` has frozen. `@testing-library/user-event` also needs `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` under fake timers. The plan's `await vi.advanceTimersByTimeAsync(0)` recipe already avoids `waitFor`, and the UI/E2E agent can sort this out within its own test files. One extra line in T-UI-16 would save that agent some retries: "use `fireEvent`, or `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`, and no `findBy*` / `waitFor` while fake timers are on".

**A-5 · FE-15 may trip SonarQube's cognitive-complexity rule at Phase 7b.** `ToastProvider` in `frontend/src/components/ui/toast.tsx` already renders two near-duplicate branches (error `div role="alert"` and success `<output>`) inside one `map` callback. FE-15 adds an appearance branch with four class sets, an optional icon, an optional animation class and a re-coloured close button. Sonar rule S3776 (cognitive complexity) is rated Critical in the default profile, and Phase 7b fails on any Critical issue. `rules/workflow.md` §3 allows fixing this in place ("Code smell / complexity → fix in-place"), so the gate can still pass. Suggestion: FE-15 builds the classes from a small lookup keyed by `appearance` × `variant` (or a `ToastCard` subcomponent) rather than adding nested conditionals.

**A-6 · The Phase 5 paste route needs to follow D-15.** The default Plan Review handoff for `PASS` recommends Build Mode with `Phase = Both`. D-15 ★ requires Backend Build to finish and be committed before Frontend Build starts. With `Phase = Both`, the two subagents would run in parallel and break D-15. The Next Step below therefore recommends `Phase = Backend`, then `Phase = Frontend`. No plan change is needed, but the developer should not use `Phase = Both` for this version.

---

## Verification Notes (claims checked against the repository)

- **D-15 (the frontend typecheck stays green after BE-08).** At `@ts-rest/core@3.52.1` the client request body is `ZodInputOrType<T['body']>`, which is `z.input` (`node_modules/.pnpm/@ts-rest+core@3.52.1_…/src/lib/infer-types.d.ts` line 54; `type-utils.d.ts` line 16). Every request rule set is `z.custom<unknown>().transform(...)` (`packages/contracts/src/transactions/transaction-validation.ts`), so each body key's input type is `unknown`, and `zod@3.25.76` makes those keys optional. No frontend code builds a `Transaction` literal. The claim holds.
- **pnpm filters.** `pnpm --filter backend` and `--filter @workflow-demo/contracts --filter backend` both resolve to the intended workspaces. The scope may be omitted.
- **INT-05 environment.** `backend/src/index.ts` tries `.env` in the working directory first, then `../.env` and `../../.env` relative to the script. Node's `process.loadEnvFile` does not override variables already set, so the inline `DATABASE_PATH` / `JWT_SECRET` take precedence. The repository-root `.env` exists (contents not read). `.gitignore` covers `*.db`, `*.db-shm` and `*.db-wal`. The nested worktree has its own `pnpm-workspace.yaml`, so `pnpm install` inside it does not touch the outer workspace, and `pnpm -r` does not pick the worktree up.
- **T-UA-07 harness.** `TestApp.accessTokenSigner` is a `JoseAccessTokenSigner(config.jwtSecret, clock)` with `sign(userId)`. Verification uses `clock.now()` (`backend/src/features/auth/ports/access-token-signer.ts`). `ACCESS_TOKEN_LIFETIME_SECONDS = 900`, `TEST_START_TIME = 2026-09-30T12:00:00.000Z`, and `TestClock.advanceBy` exists.
- **T-UA-01.** `runMigrations` wraps drizzle's better-sqlite3 migrator over `MIGRATIONS_FOLDER`. The journal has exactly `0000`–`0002`. `client.test.ts` already uses temporary directories, and its table-list assertion is unaffected by a column change.
- **D-24.** `transactionDateSchema`, `isValidCalendarDate`, `DATE_PATTERN`, `DATE_REQUIRED` and `DATE_INVALID` are referenced only in the two files BE-08 and FE-10 edit. `CalendarIcon` is used only by `transaction-form-fields.tsx`. `ChevronDownIcon` is still used by `select-field.tsx`.
- **D-32 / D-33.** `toast.tsx` matches the description (fixed `TOAST_DURATION_MS = 5000`, `bg-brand-teal` / `bg-red-600`, white text, `CloseIcon` close button, `<output>` / `role="alert"`, fixed top-right container). `toast.test.tsx` pins those classes and 5000 ms. `tailwind.config.ts` only extends the palette and defines just `shake`. `icon-input.tsx` uses `motion-safe:animate-shake`. Tailwind is locked at `3.4.19`.
- **D-29.** `transaction-row.tsx` `formatDate` uses `toLocaleDateString("en-US", …)` (renders `Oct 15, 2025`), and `transactions-page.png` shows `15 Oct 2025`.
- **Cross-feature.** No `auth` / `profile` code (backend, frontend, contracts, E2E) reads the `transactions` table or `Transaction` shape. `profile-service.test.ts` only asserts that the export has no `transactions` key.
- **Path ownership.** Every task's files fall inside its phase's allowed paths. FE-15's `frontend/tailwind.config.ts` and the new `frontend/src/components/ui/*.test.tsx` files are inside `frontend/`. T-UA-06's file sits under `packages/contracts/src/**/*.test.ts`, which `test-build-mode.md` allows.

---

## Checklist Summary

| # | Point | Result | Note |
| :-- | :--- | :--- | :--- |
| 1 | Coverage | PASS | Every 1.1.0 changelog item, REQ-TXN-01 to 04, `fds.md` §2, §4, §5, all seven §6 ACs, `behavior.md` §1–§4 and every visual map to tasks in §7. Starred deviations (D-25, D-29, D-30, the D-32/D-33 close button) are written decisions. |
| 2 | Traceability | PASS | Every BE, FE, INT and test item carries a trace to a REQ ID, an FDS / behavior section, a visual, or a decision. |
| 3 | Cross-section consistency | PASS | Field set `title, description, category, type, amount`, no `date` in requests, `fieldErrors` keys, ordering `date → createdAt → id`, UTC "today", and toast options all agree across §3–§6 and `contract.md`. One wording slip (A-1). |
| 4 | Rule compliance | PASS | Layering unchanged. No new library, error code or `DomainError`. Contracts stay in `packages/contracts`. Named constants are used. |
| 5 | Testability | PASS | T-UA-01 to 08 and T-UI-01 to 17 cover every requirement with implementation tasks. Phase 6 (D-28) covers the colour and motion checks that jsdom cannot make. |
| 6 | Ambiguity carried forward | PASS | UTC basis, trimming, UTF-16 counting, `date` dropped silently, backfill edge cases, future-dated legacy rows, Date format, toast duration, appearance, slide-in and close button are all explicit decisions (starred where they are choices). |
| 7 | API Contract completeness | PASS | All four operations, shapes, rule sets with exact messages, statuses and error codes are specified. Written in plain language with no framework code. |
| 8 | Executability | PASS | Ownership, build order (D-15), per-task typecheck windows, migration procedure, INT-05 worktree lifecycle (D-31) and gates are executable at the locked tool versions. A-3, A-4 and A-5 are friction points, not blockers. |

---

## Outside Plan Scope

- `sonar-project.properties` declares `sonar.projectVersion=1.0.0`, which is unrelated to feature versions. It is noted only because Phase 8c reports will carry that label.
