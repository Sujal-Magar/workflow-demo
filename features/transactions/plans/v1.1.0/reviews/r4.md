# Plan Review: transactions (v1.1.0)

- **Plan under review:** `plan.md`, Revision 3 (2026-10-04)
- **Contract under review:** `contract.md`, Revision 2 (2026-10-04)
- **Directives applied:** `directives.md` B-1 to B-4, and the authorization to revise beyond the 3-revision bound
- **Reviewed:** 2026-10-04T05:53:30Z
- **Earlier review:** archived to `reviews/r3.md` without being read

## Verdict

**CHANGES REQUIRED**: one Blocking finding (B-1).

---

## Blocking Findings

### B-1 · Toast colors and icons do not match `fds.md` §4, and §7 says they are covered when nothing checks them

- **Origin:** Pre-existing. The gap is in the built v1.0.0 code, and the plan's wording about it was there before Revision 3. Revision 3 changed the §7 row for `fds.md` §4 under directive B-4, but kept the clause "copy and colors regression only".
- **Plan location:** §7 matrix, rows "`fds.md` §4 UI Feedback & Notification Patterns (… copy and colors regression only)" and "`fds.md` §6 AC 7: green success / red error toasts"; D-28 (Phase 6 covers only the 1.1.0 deltas); D-32 and FE-15 (edit the same toast component and the same three dialogs); T-UI-04, T-UI-05, T-UI-06, T-UI-09, T-UI-16 (check copy, closing and timing only).
- **Spec:** `fds.md` §4: "**Toast / Success**: Light green banner with green checkmark icon (`#22C55E`)" and "**Toast / Error**: Light red banner with red alert circle icon (`#EF4444`)"; `fds.md` §6 AC 7, "green success toasts … red error toasts"; `visuals/transaction-toast-success.png` (pale green banner, green check-circle icon, dark green text) and `visuals/transaction-toast-error.png` (pale red banner, red alert-circle icon, dark red text).
- **Repository evidence:** every `transactions` toast goes through the shared `ToastProvider` in `frontend/src/components/ui/toast.tsx`. That component renders a success toast as a solid `bg-brand-teal` banner (`#00B894`, `frontend/tailwind.config.ts`) with white text and no icon. It renders an error toast as a solid `bg-red-600` banner with white text and no icon. The only icon is the close button (`CloseIcon`). `frontend/src/components/ui/icons.tsx` has no check-circle or alert-circle icon. The existing `toast.test.tsx` pins the current classes (`toHaveClass("bg-brand-teal")`, `toHaveClass("bg-red-600")`).
- **Condition (a), spec violation.** If the plan is built as written, the Add, Edit and Delete toasts look different from `fds.md` §4 and from both toast visuals. The success toast is solid teal with no checkmark, and the error toast is solid red with no alert icon. Neither is the light banner with an icon that the spec describes. No step catches this:
  - The plan has no task for the toast's appearance.
  - No test asserts it.
  - D-28 keeps toasts out of Phase 6.
  - §7 records the toast colors as "regression only", which tells Build, Phase 6 and Validation that the colors already meet the spec. They do not.

  Phase 9 Validation would find the deviation after Build and Test, and that sends the feature back to planning. The Advisory exception for "values that Phase 6 UI Review checks anyway" does not apply here, because D-28 keeps toasts out of Phase 6.
- **Why the plan cannot pass this silently:** this is the same kind of gap as the 4000 ms dismiss in directive B-4. B-4 is a pre-existing `fds.md` §4 deviation in the same component that the plan now fixes. The plan handles a comparable pre-existing visual gap, the Edit amount prefix, with an explicit starred decision (D-25). Here it has neither a fix nor a recorded acceptance.

---

## Advisory Findings

- **A-1 · Route file outside D-26's coverage scope.** D-26 applies the 90% target to `backend/src/features/transactions/`, `packages/contracts/src/transactions/` and `frontend/src/features/transactions/`. `sonar-project.properties` measures coverage over all of `frontend/src`, so `frontend/src/app/(protected)/transactions/page.tsx` also counts. No planned test renders it, and `frontend/src/app/app-routes.test.tsx` does not mention it. The file is three statements, so it will not move the gate. A line in T-UI-01, or a note in D-26, would make the scope match what Sonar measures.
- **A-2 · Delete failure is an inline alert, not a red toast.** `fds.md` §6 AC 7 reads "failed operations trigger red error toasts". The delete failure stays an inline `FormAlert` (FE-15, T-UI-06), carried forward from v1.0.0. That is a written v1.0.0 decision, so this is not a silent assumption. If the developer wants it confirmed at the Approval Gate, it could be starred or named in the §7 row for AC 7.
- **A-3 · Stale reference in the plan header.** The "Sources synthesized" line calls the third Plan Review `review.md`. That file is now archived as `reviews/r3.md`. Update the reference in the next revision.
- **A-4 · §7 row for AC 7.** That row lists only copy tests (T-UI-04, T-UI-05, T-UI-06, T-UI-09). Whatever B-1 resolves to, the row should name the test that verifies, or the decision that accepts, "green" and "red".

---

## Checklist Summary

| #   | Point                         | Result | Note                                                                                                                                                                                                                                                                                                 |
| :-- | :---------------------------- | :----- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Coverage                      | FAIL   | `fds.md` §4 toast colors and icons, and the "green" / "red" in AC 7, have no implementing task (B-1). Every other requirement and behavior maps to tasks.                                                                                                                                         |
| 2   | Traceability                  | PASS   | Every task cites a requirement, an FDS section or a decision.                                                                                                                                                                                                                                    |
| 3   | Cross-section consistency     | PASS   | Backend, Frontend, Integration and Testing agree on the field set, the dropped `date`, the ordering keys, the error mapping and the toast duration.                                                                                                                                          |
| 4   | Rule compliance               | PASS   | No new library. Layering is kept. The per-toast option in D-32 stays inside the existing component.                                                                                                                                                                                          |
| 5   | Testability                   | FAIL   | No test verifies the `fds.md` §4 toast appearance, yet §7 says it is covered (B-1). The rest of the test list is concrete and sufficient.                                                                                                                                                             |
| 6   | Ambiguity carried forward     | PASS   | The specs are not ambiguous on toast styling. B-1 is a missed spec requirement, not an assumption about an unclear one. Earlier spec gaps (UTC, backfill, timeframe) are resolved in the FDS.                                                                                               |
| 7   | API Contract completeness     | PASS   | All four operations, the shapes, rule sets, statuses and error codes are fully specified, in technology-agnostic prose.                                                                                                                                                                              |
| 8   | Executability                 | PASS   | Path ownership, build order (D-15), INT-05 scratch setup and cleanup (D-31), migration generation (BE-09) and coverage outputs (`lcov` paths in `sonar-project.properties`) all check out against the repository at `1c226d9`. There are no code diffs between `1c226d9` and `HEAD`. |

Points checked against the repository:

- **D-15:** request schemas are `z.custom<unknown>().transform(...)` at `zod@3.25.76` and `@ts-rest/core@3.52.1`. `frontend/src/features/transactions/api/transactions-api.ts` builds its request type from `Pick<Transaction, …>`, so BE-08 alone leaves the frontend typecheck green.
- **D-24:** every removed symbol has only the users the plan names.
- **D-31 / INT-05:**
  - `backend/src/index.ts` loads `.env` only from the current directory, `../.env` and `../../.env`, so the worktree needs `JWT_SECRET` passed inline.
  - `DATABASE_PATH` is read by `loadConfig`.
  - `.gitignore` ignores `*.db*`.
  - `eslint.config.mjs` does not ignore `backend/data/`, so removing the worktree before the gates is required, as the plan says.
- **T-UA-01:** `runMigrations` hard-codes `MIGRATIONS_FOLDER`, so the partial `0002` setup must call the Drizzle migrator directly on a temporary folder. That is test-only code and is allowed.
- **T-UI-16:** `renderWithProviders` mounts the real `ToastProvider`.
- **Contract package coverage:** `transaction-contract.ts` is loaded through `src/index.ts` by `auth-contract.test.ts`.

---

## Outside Plan Scope

- In the Add modal, the built Description and Amount inputs are full width. In `transaction-add-modal.png` they are content width. This is v1.0.0 layout, not touched by 1.1.0.

---

## Suggested Next Step

**Retry bound:** the plan header shows 3 revisions. Under `rules/workflow.md` §8 another revision needs the developer's explicit authorization. That authorization is already recorded in `directives.md` ("Authorization for Revision Beyond 3-Revision Retry Bound": Revision 4 and later authorized). This would be Revision 4.

### 1. Classification

**B-1 · Toast colors and icons: developer decision.** `DECISION NEEDED`

| Option | What it means                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Trade-off                                                                                                                                                                                                                                                                           |
| :----- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A      | **Per-toast appearance, transactions only.** Extend D-32's `ToastOptions` with an optional appearance, for example `appearance: "banner"`. With it, a success toast renders a light green banner with a green (`#22C55E`) check-circle icon, and an error toast renders a light red banner with a red (`#EF4444`) alert-circle icon, per the two toast PNGs. Without it, toasts render exactly as they do today. Add `CheckCircleIcon` and `AlertCircleIcon` to `icons.tsx`. The transactions dialogs pass the appearance through the same shared options object as `TRANSACTION_TOAST_DURATION_MS`. Extend FE-15 or add an FE task, add appearance checks to T-UI-16 or a new T-UI test (icon present, light background, for each of the five transactions toasts), add both toast visuals to D-28's Phase 6 list, and correct the §7 rows for §4 and AC 7. INT-06 records that default appearance and `toast.test.tsx` are unchanged. | Matches the FDS and the visuals for `transactions`, consistent with how B-4 was decided. `auth` and `profile` keep their current look, so the app has two toast styles. Adds a second option to the shared API and two icons. |
| B      | **Restyle the shared toast app-wide** to the `fds.md` §4 look, with light banners and icons.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | One consistent toast style. Neither the `auth` nor the `profile` spec defines toast styling, so nothing forbids it. But it changes how `auth` and `profile` look, needs edits to the `auth`-era `toast.test.tsx` (it asserts `bg-brand-teal` / `bg-red-600`), and INT-06 becomes a cross-feature change.             |
| C      | **Accept the built styling.** Add a starred decision like D-25: the toast appearance predates 1.1.0, is outside the 1.1.0 changelog, and is left as built, with any change as a separate follow-up. Correct the §7 rows for §4 and AC 7 so they say the colors and icons deviate and are accepted, not "regression only".                                                                                                                                                                                                                                                                                                                                                               | Least work and stops the loop. But the deviation from explicit `fds.md` §4 text stays, and Phase 9 Validation will report it unless the developer also amends `fds.md` §4 through the change process (`rules/workflow.md` §4).                                                                 |

**Recommendation:** A. It applies the FDS as written and follows the same approach the developer chose for the same component in B-4, without touching `auth` or `profile`. This is a recommendation only. The developer decides.

The advisory findings A-1 to A-4 can go into the same revision. Each can be closed by the Synthesizer inside the plan text without a developer decision.

### 2. Revision prompt

```text
Read the file .ai/prompts/plan/plan-synthesizer.md and follow it exactly. That is your system prompt.

Feature ID = transactions
Revision run (revision 4; authorized beyond the 3-revision bound in features/transactions/plans/v1.1.0/directives.md).
Plan Review (features/transactions/plans/v1.1.0/review.md) returned CHANGES REQUIRED.
Apply every decision in features/transactions/plans/v1.1.0/directives.md, including the new B-5 (toast colors and icons, fds.md §4 / §6 AC 7 / visuals/transaction-toast-*.png).
Also apply advisory findings A-1 (D-26 or T-UI-01 covers frontend/src/app/(protected)/transactions/page.tsx), A-2 (state the Delete-failure inline alert against AC 7 in the §7 row), A-3 (plan header cites reviews/r3.md for the third review) and A-4 (§7 AC 7 row names what verifies or accepts the colors).
Revise plan.md and contract.md in place. Do not change other sections.
```

### 3. `directives.md` skeleton (append)

```markdown
## B-5 Toast colors and icons (fds.md §4, §6 AC 7; visuals/transaction-toast-success.png, transaction-toast-error.png)

Options considered: A) optional per-toast appearance in the shared toast API (default unchanged); transactions toasts render the light green / light red banner with #22C55E check-circle / #EF4444 alert-circle icons; new icons in icons.tsx; FE task, T-UI assertions, D-28 Phase 6 adds both toast visuals, §7 rows for §4 and AC 7 corrected, INT-06 notes default unchanged; B) restyle the shared toast app-wide (auth/profile change; toast.test.tsx updated; INT-06 cross-feature); C) accept the built styling as a starred decision like D-25, correct §7 to say the deviation is accepted
Decision: <developer to fill in>
Apply to: FE-15 or a new FE task, D-32 or a new decision, D-28, T-UI-16 or a new T-UI test, INT-06, §7 rows for fds.md §4 and §6 AC 7
Record as a starred (★) decision in the plan's Decision Log: yes
```
