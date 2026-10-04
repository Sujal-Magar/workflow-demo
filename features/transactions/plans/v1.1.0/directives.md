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

Options considered: A) worktree at backend/data/int05-worktree, DB at backend/data/int05.db, JWT_SECRET from backend/.env, worktree and DB removed before the root gates; B) developer produces backend/data/int05.db (0002 schema, seeded users and legacy rows incl. one future-dated row) before Integration, INT-05 only verifies
Decision: A — worktree at backend/data/int05-worktree, DB at backend/data/int05.db, JWT_SECRET from backend/.env, worktree and DB removed before the root gates. Keep the worktree inside `backend/data/int05-worktree` (`git worktree add backend/data/int05-worktree 1c226d9`), run `pnpm install` inside it, and pass `JWT_SECRET` from `backend/.env` (copied into worktree or passed inline). The database is `backend/data/int05.db`. Remove the worktree (`git worktree remove`) and delete `int05.db` (including `-shm` and `-wal` files) before running the root lint, typecheck, and test gates.
Apply to: INT-05, §2 step 4
Record as a starred (★) decision in the plan's Decision Log: yes
