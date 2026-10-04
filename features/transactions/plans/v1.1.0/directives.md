# Directives: transactions v1.1.0

## B-1 Ledger date format (15 Oct 2025 vs built Oct 15, 2025)

Options considered: A) render `15 Oct 2025` in FE-13 (explicit month abbreviations, not bare en-GB), add Date to D-28, exact assertion in T-UI-03; B) keep `Oct 15, 2025` as a starred decision like D-25, T-UI-03 asserts the built format
Decision: A — render `15 Oct 2025` (match the visual). Add to FE-13: `transaction-row.tsx` renders the Date cell as `15 Oct 2025` (day, short month, year, UTC). Build the string explicitly from a fixed month-abbreviation list, or with `formatToParts` (avoiding bare `en-GB`, which renders September as `15 Sept 2025` on this Node runtime). Add the Date column to the D-28 Phase 6 review, and make T-UI-03 assert the exact string for at least one September date and one other month.
Apply to: FE-13, D-28, T-UI-03, §7 matrix (visuals row)
Record as a starred (★) decision in the plan's Decision Log: yes

## B-2 New record vs pre-1.1.0 rows dated after today

Options considered: A) accept and document: starred decision, contract §2.3 note, INT-05 reworded and seeded with a future-dated legacy row; B) order newest/oldest by createdAt then id, ignoring date
Decision: A — accept and document: starred decision, contract §2.3 note, INT-05 reworded and seeded with a future-dated legacy row. Add a starred decision: under `Newest First`, a new row sits below any pre-1.1.0 row dated after today. This is transitional, because no new row can be dated later than today. Add the note to contract §2.3 and plan D-16. Reword INT-05 to "at the top of the default view, unless a legacy row is dated later than today", and have INT-05 seed one such row to confirm the documented order.
Apply to: D-16 or a new decision, D-22, contract §2.3, BE-10, INT-05, T-UA-02, T-UI-09
Record as a starred (★) decision in the plan's Decision Log: yes

## B-3 INT-05 scratch database outside the repository

Options considered: A) worktree at backend/data/int05-worktree, DB at backend/data/int05.db, JWT_SECRET from the repository-root .env, worktree and DB removed before the root gates; B) developer produces backend/data/int05.db (0002 schema, seeded users and legacy rows incl. one future-dated row) before Integration, INT-05 only verifies
Decision: A — worktree at backend/data/int05-worktree, DB at backend/data/int05.db, JWT_SECRET from the repository-root .env, worktree and DB removed before the root gates. Keep the worktree inside `backend/data/int05-worktree` (`git worktree add backend/data/int05-worktree 1c226d9`), run `pnpm install` inside it, and pass `JWT_SECRET` from the repository-root `.env` (copied into worktree or passed inline). The database is `backend/data/int05.db`. Remove the worktree (`git worktree remove`) and delete `int05.db` (including `-shm` and `-wal` files) before running the root lint, typecheck, and test gates.
Apply to: INT-05, §2 step 4
Record as a starred (★) decision in the plan's Decision Log: yes

## B-4 Toast auto-dismiss after 4000ms (fds.md §4)

Options considered: A) optional per-toast duration in the shared toast API (default stays 5000 ms), transactions dialogs pass TRANSACTION_TOAST_DURATION_MS = 4000, new Frontend Build task, new fake-timer component test, INT-06 lists toast.tsx as shared with unchanged default; B) change TOAST_DURATION_MS to 4000 app-wide, update toast.test.tsx, INT-06 becomes a cross-feature change; C) developer amends fds.md §4 to 5000 ms, plan adds only a verifying test
Decision: A — optional per-toast duration in the shared toast API (default stays 5000 ms), transactions dialogs pass TRANSACTION_TOAST_DURATION_MS = 4000. Add a new Frontend Build task to update the shared toast API (`toast.tsx`) with an optional duration parameter while preserving the 5000 ms default (`TOAST_DURATION_MS = 5000`). The three transactions dialogs pass `TRANSACTION_TOAST_DURATION_MS = 4000`. Add a new fake-timer component test verifying dismissal at 4000 ms and on user interaction (close button). Update §7 matrix row for `fds.md` §4 from "regression only". INT-06 lists `toast.tsx` as a shared file with unchanged default behavior.
Apply to: new FE task, §6.2 test list (new or extended T-UI test), §7 matrix row for fds.md §4, INT-06, §2 step 2
Record as a starred (★) decision in the plan's Decision Log: yes

## Authorization for Revision Beyond 3-Revision Retry Bound (rules/workflow.md §8)

- **Context / Finding**: Revision 3 was committed following Plan Review Round 3. Under `rules/workflow.md` §8, self-correction loops are bounded at 3 attempts, requiring explicit developer authorization recorded in `directives.md` to proceed with any subsequent revision (Revision 4+).
- **Decision**: Authorized by developer. The developer explicitly authorizes proceeding with Revision 4 (and further revisions if needed) should Plan Review require additional adjustments before approval.
- **Record as a starred (★) decision in the plan's Decision Log**: no

## B-5 Toast colors and icons (fds.md §4, §6 AC 7; visuals/transaction-toast-success.png, transaction-toast-error.png)

Options considered: A) optional per-toast appearance in the shared toast API (default unchanged); transactions toasts render the light green / light red banner with #22C55E check-circle / #EF4444 alert-circle icons; new icons in icons.tsx; FE task, T-UI assertions, D-28 Phase 6 adds both toast visuals, §7 rows for §4 and AC 7 corrected, INT-06 notes default unchanged; B) restyle the shared toast app-wide (auth/profile change; toast.test.tsx updated; INT-06 cross-feature); C) accept the built styling as a starred decision like D-25, correct §7 to say the deviation is accepted
Decision: A — optional per-toast appearance in the shared toast API (default unchanged). Add an optional style/appearance setting (e.g. `appearance: "banner"`) to `ToastOptions` in `toast.tsx`. When specified, a success toast renders a light green banner with a green (#22C55E) check-circle icon, and an error toast renders a light red banner with a red (#EF4444) alert-circle icon per `visuals/transaction-toast-success.png` and `transaction-toast-error.png`. Add `CheckCircleIcon` and `AlertCircleIcon` to `frontend/src/components/ui/icons.tsx`. Transactions dialogs pass the appearance option along with `TRANSACTION_TOAST_DURATION_MS`. Extend FE-15 (or add an FE task), add appearance assertions to T-UI-16 or a new T-UI test, add both toast visuals to D-28 Phase 6 list, correct §7 rows for §4 and AC 7, and note in INT-06 that default appearance and `toast.test.tsx` remain unchanged.
Apply to: FE-15 or a new FE task, D-32 or a new decision, D-28, T-UI-16 or a new T-UI test, INT-06, §7 rows for fds.md §4 and §6 AC 7
Record as a starred (★) decision in the plan's Decision Log: yes

## B-6 Toast slide-in (behavior.md §2; review B-1, fifth review)

Options considered: A) slide-in entry animation for the banner appearance only (tailwind.config.ts keyframes, motion-safe; FE-15, D-33, T-UI-17 class assertion, D-28 Phase 6 check); B) slide-in for every toast app-wide (auth/profile change; INT-06 cross-feature); C) accept instant appearance as a starred deviation like D-25 (§7 row states it)
Decision: A — slide-in entry animation for the banner appearance only. In `frontend/tailwind.config.ts`, define keyframes and animation for toast slide-in from the top right, applied in `toast.tsx` only when `appearance: "banner"` behind `motion-safe:`. Record in D-33. T-UI-17 asserts the animation class on banner toasts and its absence on default toasts. Add the slide-in animation check to D-28 Phase 6 UI review, and update §7 rows for `behavior.md` §2 and `fds.md` §4. `auth` and `profile` toasts remain unchanged.
Apply to: FE-15, D-33, D-28, T-UI-17, §7 rows for behavior.md §2 and fds.md §4
Record as a starred (★) decision in the plan's Decision Log: yes

## B-7 Close button on the banner toast vs. toast visuals (review B-2, fifth review)

Options considered: A) keep the × close button in the banner look, recorded as a starred deviation from visuals/transaction-toast-success.png and transaction-toast-error.png, and D-28 tells Phase 6 to expect it; B) no × in the banner look, click-anywhere-to-dismiss (semantics and keyboard path to define; T-UI-16/17 updated); C) no manual dismissal (conflicts with fds.md §4)
Decision: A — keep the × close button in the banner look and record it as a starred deviation from the two toast visuals (`visuals/transaction-toast-success.png` and `transaction-toast-error.png`). It preserves the existing, accessible keyboard path to satisfy `fds.md` §4 ("or on user interaction"). Update D-32 and D-33 to note that while the visuals omit a dismiss control, the × button is intentionally retained. Instruct D-28 Phase 6 review to expect the close control. FE-15, T-UI-16, and T-UI-17 keep the close button.
Apply to: D-32, D-33, FE-15, D-28, T-UI-16, T-UI-17
Record as a starred (★) decision in the plan's Decision Log: yes

## Authorization for Revision 5 (rules/workflow.md §8)

Decision: Confirmed. The developer confirms that the authorization recorded under "Authorization for Revision Beyond 3-Revision Retry Bound" covers Revision 5 (and subsequent revisions if needed). Proceed with Revision 5 to apply B-6, B-7, and review advisories A-1 to A-3.
Record as a starred (★) decision in the plan's Decision Log: no
