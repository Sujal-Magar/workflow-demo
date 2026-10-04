# Plan Review: transactions (v1.1.0)

- **Plan under review:** `plan.md` Revision 4 (2026-10-04), with `contract.md` Revision 3
- **Inputs:** `fds.md` 1.1.0, `behavior.md`, `visuals/*.png` (all six), `directives.md` (B-1 to B-5 and the retry-bound authorization), `rules/*`, `features/index.json`
- **Evidence checked in the repository:** `frontend/src/components/ui/toast.tsx`, `toast.test.tsx`, `icons.tsx`; `frontend/tailwind.config.ts`; `frontend/src/test/render-with-providers.tsx`; the three `transactions` dialogs, `transaction-row.tsx`, `transactions-table.tsx`, `lib/*`, `api/transactions-api.ts`; `packages/contracts/package.json` and `src/transactions/transaction-validation.ts`; `backend/src/db/schema/transactions.ts`, `db/migrate.ts`, `migrations/meta/_journal.json`, `features/transactions/transaction-service.ts`, `transaction-repository.ts`, `test-support/auth-test-harness.ts`, `features/auth/ports/access-token-signer.ts`, `auth-constants.ts`; `git show 1c226d9:backend/src/index.ts`; `playwright.config.ts`; `sonar-project.properties`; `frontend/vitest.config.ts`; `pnpm-lock.yaml` (`zod@3.25.76`, `@ts-rest/core@3.52.1`, `tailwindcss@3.4.19`, `drizzle-kit@0.24.2`); `node_modules/.pnpm/@ts-rest+core@3.52.1_…/src/lib/type-utils.d.ts` and `infer-types.d.ts` (client body typed as `z.input`, which confirms D-15)
- **Review type:** Revision run (directives present; plan header records 4 revisions)

---

## Verdict

**CHANGES REQUIRED**

Two Blocking findings. Both are about the `transactions` toasts, the area Revisions 3 and 4 opened up (D-32, D-33). Everything else checked holds: the D-15 build order and its typecheck claim at the locked versions, the migration rebuild, the UTC date rules, the Tailwind palette values in D-33, the test harness API, and the INT-05 worktree procedure against the baseline commit.

---

## Blocking Findings

### B-1 · Toasts do not "slide in" (`behavior.md` §2). No task, no test, no recorded decision

- **Plan sections:** FE-15 and D-33 (toast appearance), D-28 (Phase 6 scope), §6.2 T-UI-16 / T-UI-17, §7 rows for `behavior.md` §2 and `fds.md` §4.
- **Spec:** `behavior.md` §2 step 3: "**On submission error**: A light red error toast notification **slides in** at the top right" and "**On submission success**: … a light green success toast **slides in**".
- **What the plan says:** nothing. Neither `plan.md` nor `../v1.0.0/plan.md` mentions an entry animation. The built `ToastProvider` (`frontend/src/components/ui/toast.tsx` lines 76–120) puts the toast in a fixed top-right container with no transition or animation class. `frontend/tailwind.config.ts` defines only the `shake` keyframes, and no toast-related animation exists anywhere under `frontend/src`. FE-15 rewrites how the `transactions` toasts look (colors, icon, close-button color) and says "Nothing else changes". The §7 row for `behavior.md` §2 maps to FE-12, INT-05, D-16, D-30, T-UI-04 and T-UI-09, and none of them covers the slide-in.
- **Condition:** (a) Spec violation. Built as written, the `transactions` toasts appear instantly instead of sliding in, against an explicit `behavior.md` behavior, and no task implements it and no test or review step checks it. Also (f): the plan treats this as unchanged without saying so. That differs from D-25, where a similar gap that predates 1.1.0 was written down and starred. The plan's pattern for toast gaps that predate 1.1.0 (D-32 duration, D-33 appearance: "a pre-existing gap in the built v1.0.0 code") makes the omission inconsistent. Phase 6 (D-28) checks static visuals only, so nothing before Phase 9 would surface it.
- **Concrete failure:** Phase 9 Validation reports `behavior.md` §2 as unmet for both toasts, which forces a frozen-plan change through the Approval Gate.
- **Origin:** Pre-existing.

### B-2 · The banner toast keeps a close button that the toast visuals do not show, and the plan does not record the deviation

- **Plan sections:** D-33 ("the close button keeps its label and switches to the banner's dark text color so it stays visible on the light background"), FE-15 (`toast.tsx` banner bullet), D-28 (Phase 6 checks the toast appearance "against `visuals/transaction-toast-success.png` and `visuals/transaction-toast-error.png`"), T-UI-17 ("in addition to the close button's icon").
- **Spec:** `visuals/transaction-toast-success.png` and `visuals/transaction-toast-error.png` show the full banner: icon, message, rounded pale background, soft shadow, and **no close (×) control**. `fds.md` §4 says "Toasts auto-dismiss after 4000ms **or on user interaction**" and does not name the interaction.
- **What the plan says:** D-33 describes the visuals in detail (pale fill, solid circular icon, dark text) but never says the visuals have no close button. It then specifies a restyled, visible close button for the banner look. D-32 decides that "dismissal on user interaction is the existing close button", but that decision predates the banner and was made without the visuals in view. So the plan says it matches both visuals, Phase 6 checks against both, and the specified build visibly differs from both.
- **Condition:** (a) Spec violation: the banner toast built as written differs from `visuals/`. (f) Silent ambiguity: how "on user interaction" coexists with a visual that has no dismiss control is settled by assumption, without a written trade-off. The alternatives behave differently: a visible × button, a click-anywhere-to-dismiss banner, or no manual dismissal.
- **Concrete failure:** At Phase 6 the reviewer compares the rendered banner with the two visuals as D-28 instructs and finds an extra × control that no decision covers. Phase 6 then either fails, which sends Frontend Build back to choose between observably different dismissal behaviors, or signs off on an unrecorded deviation, which Phase 9 then reports.
- **Origin:** Revision. It is in the text Revision 4 added under directive B-5, which asked for the toasts to match "per `visuals/transaction-toast-success.png` and `transaction-toast-error.png`". The plan applied B-5 incompletely.

---

## Advisory Findings

- **A-1 · T-UA-07 `PUT` step: the access token expires when the clock advances.** T-UA-07 creates a transaction, advances the `TestClock` "several days", then sends `PUT` and a follow-up `GET`. Access tokens live `ACCESS_TOKEN_LIFETIME_SECONDS = 900` (`backend/src/features/auth/auth-constants.ts`) and are verified against the same clock (`access-token-signer.ts` line 41, `currentDate: this.clock.now()`). Both requests would return `401` unless the test signs in again, or mints a fresh token with `TestApp.accessTokenSigner`, after advancing. The Unit/API agent can fix this in its own scope. Worth one sentence in T-UA-07.
- **A-2 · T-UA-07 follow-up `GET` needs `timeframe=all_time`.** `startTestApp` starts the clock at `TEST_START_TIME = 2026-09-30T12:00:00.000Z`, the last day of a month. After advancing several days the clock is in October, so a default (`this_month`) `GET` no longer returns the September-dated row whose `date` the test means to check. The same applies to the T-UA-04 service-level check if it reads back through `listTransactions`. Say "query with `timeframe=all_time`" (or read by id) in T-UA-07.
- **A-3 · D-32 / D-33 and the visual's dismiss behavior.** Whatever B-2 decides, add one line to D-32 saying how "on user interaction" relates to the toast visuals, so the two decisions do not describe the dismissal in two places.

---

## Checklist Summary

| # | Point | Result |
| :-- | :---- | :----- |
| 1 | Coverage | **FAIL**: `behavior.md` §2 toast slide-in has no implementing task (B-1). |
| 2 | Traceability | PASS: every task and test cites an FDS / behavior / visual section or a decision. |
| 3 | Cross-section consistency | PASS: Backend, Frontend, Integration and Testing agree on `title`, the dropped `date`, ordering, error mapping, and the toast options shape (`TRANSACTION_TOAST_OPTIONS`). |
| 4 | Rule compliance | PASS: no new library (D-27 avoids root `better-sqlite3`); layering unchanged; contracts stay in `packages/contracts`. |
| 5 | Testability | **FAIL**: no test or review step verifies the toast slide-in (B-1). Otherwise concrete; see A-1 and A-2 for two test-setup details. |
| 6 | Ambiguity carried forward | **FAIL**: slide-in silently treated as unchanged (B-1); close button vs. toast visuals settled by assumption (B-2). |
| 7 | API Contract completeness | PASS: all four operations, shapes, rule sets, statuses and codes specified; technology-agnostic prose; no change needed by either finding. |
| 8 | Executability | PASS: path ownership, the D-15 order (confirmed at `zod@3.25.76` / `@ts-rest/core@3.52.1`), the BE-09 generate-then-hand-edit migration, the INT-05 worktree (baseline `1c226d9` exists; its `index.ts` tolerates a missing `.env`), and the coverage scope (`sonar-project.properties`, T-UI-01 covers the route file) are all executable as written. |

---

## Suggested Next Step

The specs are sound. Both findings are **developer decisions**. Neither changes `contract.md`.

### B-1 · Toast slide-in: DECISION NEEDED

- **Option A: add a slide-in entry animation to the banner appearance only.** FE-15 adds keyframes and an animation to `frontend/tailwind.config.ts` (Frontend Build scope), applied only when `appearance: "banner"`, behind `motion-safe:` as `auth-card.tsx` already does. D-33 records it. T-UI-17 asserts the animation class on banner toasts and its absence on default toasts. D-28 adds "toast slides in from the top right" to Phase 6, where a human can see it. `auth` and `profile` toasts are unchanged, which matches the D-32/D-33 pattern. Trade-off: one more piece of the shared toast differs between `transactions` and other features.
- **Option B: slide-in for every toast, app-wide.** Simpler code with one look everywhere, but it changes `auth` and `profile` behavior against their frozen plans and turns INT-06 into a cross-feature change. That is the same objection the developer accepted when rejecting B-4(B) and B-5(B).
- **Option C: accept the instant appearance as a starred deviation, like D-25.** No code. The §7 row for `behavior.md` §2 states the gap, and Phase 9 reports it as an accepted deviation. Trade-off: an explicit `behavior.md` behavior stays unmet.
- **Recommendation:** A. It is consistent with the developer's choices in B-4 and B-5 and keeps the change inside FE-15.

### B-2 · Close button on the banner toast: DECISION NEEDED

- **Option A: keep the × close button in the banner look and record it as a starred deviation from the two toast visuals.** It is the existing, keyboard-accessible way to satisfy "or on user interaction" (D-32). D-33 says the visuals show no close control and why one is kept. D-28 tells the Phase 6 reviewer to expect it. Trade-off: a small visible difference from the visuals.
- **Option B: no × in the banner look; clicking anywhere on the toast dismisses it.** Matches the visuals. But a clickable `role="alert"` / `<output>` region has no keyboard path unless it becomes a button. That changes the toast's semantics and needs new tests (T-UI-16 currently clicks `Dismiss notification`).
- **Option C: no × and no manual dismissal; the toast closes on the 4000 ms timer only.** Matches the visuals, but violates `fds.md` §4 "or on user interaction". Listed only for completeness; not valid without an FDS change.
- **Recommendation:** A.

### Retry bound

The plan header records **4 revisions**, which is beyond the 3-attempt bound in `rules/workflow.md` §8. `directives.md` already records the developer's authorization for "Revision 4 (and further revisions if needed)". The developer should confirm that this authorization covers Revision 5, or extend it explicitly in `directives.md`, before running the revision.

### `directives.md` skeleton (append to `features/transactions/plans/v1.1.0/directives.md`)

```text
## B-6 Toast slide-in (behavior.md §2; review B-1, fifth review)

Options considered: A) slide-in entry animation for the banner appearance only (tailwind.config.ts keyframes, motion-safe; FE-15, D-33, T-UI-17 class assertion, D-28 Phase 6 check); B) slide-in for every toast app-wide (auth/profile change; INT-06 cross-feature); C) accept instant appearance as a starred deviation like D-25 (§7 row states it)
Decision: <developer to fill in>
Apply to: FE-15, D-33, D-28, T-UI-17, §7 rows for behavior.md §2 and fds.md §4
Record as a starred (★) decision in the plan's Decision Log: yes

## B-7 Close button on the banner toast vs. toast visuals (review B-2, fifth review)

Options considered: A) keep the × close button in the banner look, recorded as a starred deviation from visuals/transaction-toast-success.png and transaction-toast-error.png, and D-28 tells Phase 6 to expect it; B) no × in the banner look, click-anywhere-to-dismiss (semantics and keyboard path to define; T-UI-16/17 updated); C) no manual dismissal (conflicts with fds.md §4)
Decision: <developer to fill in>
Apply to: D-32, D-33, FE-15, D-28, T-UI-16, T-UI-17
Record as a starred (★) decision in the plan's Decision Log: yes

## Authorization for Revision 5 (rules/workflow.md §8)

Decision: <developer to confirm that the existing authorization covers Revision 5, or extend it>
```

### Revision prompt (paste after filling in `directives.md`)

```text
Read the file .ai/prompts/plan/plan-synthesizer.md and follow it exactly. That is your system prompt.

Feature ID = transactions
Revision run. Plan Review (features/transactions/plans/v1.1.0/review.md) returned CHANGES REQUIRED.
Apply decisions B-6 and B-7 in features/transactions/plans/v1.1.0/directives.md, under the developer's
retry-bound authorization recorded there.
Also apply advisory findings A-1 and A-2 (T-UA-07: re-authenticate or mint a fresh token after advancing
the TestClock; read back with timeframe=all_time) and A-3 (one line in D-32 relating "on user interaction"
to the toast visuals).
Revise plan.md and contract.md in place. contract.md should change only its revision line.
Do not change other sections.
```

Only the frontend side is affected. The Plan Synthesizer can apply this directly, as Revisions 1–4 did, without regenerating the fragments.

---

## Outside Plan Scope

- `sonar-project.properties` still declares `sonar.projectVersion=1.0.0`.
