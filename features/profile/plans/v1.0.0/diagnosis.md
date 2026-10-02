# Diagnosis Report — profile (v1.0.0)

- **Feature:** `profile`, User Profile and Preferences
- **Trigger:** `features/profile/validation-report.md` §2.2 — `pnpm typecheck` fails with 10 errors across 8 frontend test files, on validated commit `39b7c9f`
- **Scope note:** Validation Mode's other open item — Phase 8c (SonarQube Full Quality Gate) never run — is a missing process step, not a test/code failure, and has no category in the six-way table below. It is **not** diagnosed here; it is already tracked (`activity-log.md` Code Validation 1 entry; `validation-report.md` §2.4/§5.8) and must be run once a human provisions the server's gate profiles, independent of this report.
- **Inputs read:** `features/profile/fds.md`, `features/profile/behavior.md`, `features/profile/plans/v1.0.0/plan.md` (§6 Test Inventory, §7 Spec Traceability Matrix), `features/profile/plans/v1.0.0/contract.md` §2.5, `packages/contracts/src/profile/profile-shapes.ts`, the 8 failing test files themselves, `features/profile/plans/activity-log.md`, `rules/architecture.md`, `rules/workflow.md` §3/§4/§8, `features/index.json`.
- **Retry status:** no prior Diagnosis Mode pass exists for `profile` (first `activity-log.md` entry of this type) — both findings below are on their first routing attempt, not retries.

---

## Finding D1

- **Category:** Bad test
- **Affected file(s) / Requirement/Test ID:**
  - `frontend/src/features/profile/components/change-password-dialog.test.tsx:79` (T-UI-04)
  - `frontend/src/features/profile/components/clear-all-data-dialog.test.tsx:55` (T-UI-07)
  - `frontend/src/features/profile/components/clear-all-data-dialog.test.tsx:79` (T-UI-07)
- **Routing target:** Stays in Testing — UI/E2E Test agent (the scope that wrote these specs) rewrites the fixtures in place. No Dev Agent involved.
- **Suggested Next Step:**
  `Re-run .ai/prompts/test-build-mode.md with Phase = UIE2E, pointing at frontend/src/features/profile/components/change-password-dialog.test.tsx and frontend/src/features/profile/components/clear-all-data-dialog.test.tsx and describing what's wrong with the assertion/fixture. No re-run of Integration needed.`
- **Rationale:** both files mock the resolved value of `changePassword` / `clearAllUserData` as `ProfileResult<{ success: true }>>`, e.g. `change-password-dialog.test.tsx:79`'s deferred resolve. The real success body is `ProfileSuccessAck` (`contract.md` §2.5; `packages/contracts/src/profile/profile-shapes.ts:34-37`), which requires `message: string` alongside `success: true`. These fixtures were never updated to add `message`, so `tsc --noEmit` fails while Vitest (esbuild, no type-check) still runs and passes them — exactly the drift `validation-report.md` §2.2 traces to INT-02 (`activity-log.md`, Build: Integration, 2026-10-02T10:10Z) removing the Phase-5 mocks in favor of the real `@workflow-demo/contracts` types. No file under `frontend/src/features/profile/components/change-password-dialog.tsx` or `clear-all-data-dialog.tsx` (production code) is implicated — only the `.test.tsx` fixtures.

---

## Finding D2

- **Category:** Bad test
- **Affected file(s) / Requirement/Test ID:**
  - `frontend/src/features/profile/components/data-management-actions.test.tsx:16` (T-UI-07)
  - `frontend/src/features/profile/components/edit-profile-dialog.test.tsx:15` (T-UI-03)
  - `frontend/src/features/profile/components/notification-preferences-list.test.tsx:18` (T-UI-06)
  - `frontend/src/features/profile/components/preferences-card.test.tsx:12` (T-UI-05)
  - `frontend/src/features/profile/components/profile-identity-card.test.tsx:12` (T-UI-02)
  - `frontend/src/features/profile/components/profile-page.test.tsx:16` (T-UI-01)
  - `frontend/src/features/profile/components/read-only-preferences-list.test.tsx:8` (T-UI-05)
- **Routing target:** Stays in Testing — UI/E2E Test agent (the scope that wrote these specs) rewrites the fixtures in place. No Dev Agent involved.
- **Suggested Next Step:**
  `Re-run .ai/prompts/test-build-mode.md with Phase = UIE2E, pointing at the 7 files listed in diagnosis.md Finding D2 and describing what's wrong with the fixture. No re-run of Integration needed.`
- **Rationale:** each file declares a mock `UserProfile` object (e.g. `TEST_PROFILE` at `profile-identity-card.test.tsx:12-20`) with `id`/`name`/`email`/`avatarUrl`/`preferredCurrency`/`language`/`monthlyStartDate`/`notificationPreferences` but no `createdAt`/`updatedAt`. `userProfileSchema` (`packages/contracts/src/profile/profile-shapes.ts:20-31`) requires both as `z.string()`. Same root cause and same timing as D1 — these fixtures predate INT-02's removal of the Phase-5 mock shapes (`profile-mock-data.ts`, deleted per `activity-log.md` Build: Integration entry) and were never updated when every import switched to the real contract type. No production file under `frontend/src/features/profile/components/*.tsx` (non-test) is implicated.

---

## Sequencing

No Contract-mismatch finding is present in this pass, so the contract-first sequencing rule does not apply. D1 and D2 are independent of each other (different mock fields, different files) but share one root cause (INT-02's mock removal) and the same category/routing target, so they batch into a single Testing session below.

---

## Batching Summary

Both findings route to the same target — the **UI/E2E Test agent**, in place, no Dev Agent and no Integration re-run required.

**Consolidated Suggested Next Step (one session, both findings):**

`Run .ai/prompts/test-build-mode.md: Feature = profile, Phase = UIE2E. Findings = D1, D2 (features/profile/plans/v1.0.0/diagnosis.md). Fix the stale mock fixtures: (D1) change-password-dialog.test.tsx and clear-all-data-dialog.test.tsx's ProfileResult<{ success: true }> mocks need a message: string field to match ProfileSuccessAck (contract.md §2.5); (D2) the UserProfile mocks in data-management-actions.test.tsx, edit-profile-dialog.test.tsx, notification-preferences-list.test.tsx, preferences-card.test.tsx, profile-identity-card.test.tsx, profile-page.test.tsx, and read-only-preferences-list.test.tsx need createdAt/updatedAt string fields. No production code changes. No re-run of Integration (Phase 7) needed — only re-run both Test Build scopes' verification (pnpm typecheck + pnpm test) once fixed.`

No Contract-mismatch finding to flag ahead of this group.

---

## Ambiguity & Conflict Handling

Both findings were classifiable with confidence — the exact schema field each mock is missing was confirmed by reading `profile-shapes.ts` directly against the failing test files, and no production file is referenced by either `tsc` error. Nothing in this pass is marked "Uncertain."
