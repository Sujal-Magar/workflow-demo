# Plan Review: `profile` v1.0.0

**Reviewed:** `plan.md`, `contract.md` (this directory), against `fds.md`, `behavior.md`, `visuals/profile-page.png`, `directives.md`, `rules/*`, `features/index.json`, and the frozen `features/auth/plans/v1.0.0/` plan/contract that this plan reuses from.

This is a re-review. `directives.md` exists and `plan.md`'s provenance line records four prior synthesis revisions (D-16, D-17, D-18, and the Round 4 retry-bound authorization). Per the Revision Runs rules, none of D-01, D-02, D-16, D-17, or D-18 is reopened below; `reviews/` was not used to form this verdict.

---

## Verdict: PASS

---

## Blocking Findings

None.

---

## Advisory Findings

### A-1 — `clearAllUserData` resets `preferredCurrency`/`language`/`monthlyStartDate`, which neither `fds.md` nor `behavior.md` describes as part of this action

- **Where:** `contract.md` §5.5 side effects ("`preferredCurrency`/`language`/`monthlyStartDate` reset to defaults (`"NPR"`/`"en_US"`/`1`)"); `plan.md` BE-05's `resetToDefaults(userId, updatedAt)` ("same baseline values as `create`").
- **Spec text:** `fds.md` REQ-PROF-04's D-18 addendum and `behavior.md` §5 both describe this action's v1.0.0 scope as resetting only `avatarUrl` and the three `notificationPreferences` keys ("Resets `avatarUrl` and all three notification preferences ... to their baseline defaults. Does not change the user's name, email, or password."). Neither mentions `preferredCurrency`, `language`, or `monthlyStartDate`.
- **Why this is Advisory, not Blocking:** these three fields have no write path anywhere in v1.0.0 — `updateUserProfile` silently ignores them (D-05) and REQ-PROF-02 keeps them read-only. They can therefore never hold anything but their defaults, so resetting them to their already-current values produces no observable behavior difference from the spec's narrower description. It does not meet Severity condition (a) because built-as-written behavior does not diverge from `fds.md`/`behavior.md`.
- **Suggested cleanup (non-blocking):** drop the `preferredCurrency`/`language`/`monthlyStartDate` reset from `contract.md` §5.5 and `resetToDefaults`'s stated scope, both for traceability and in case D-05's read-only guarantee is ever revisited in v1.1.0.

### A-2 — `visuals/profile-page.png` shows `INR (₹)` as Preferred Currency; `fds.md`'s enum has no `INR`

- **Where:** `visuals/profile-page.png` Preferences card; `fds.md` §2 `preferredCurrency` enum (`"NPR"` \| `"USD"` \| `"EUR"` \| `"GBP"`, default `"NPR"`).
- `plan.md` FE-06 follows the FDS enum (example `NPR (₹)`), not the mockup's literal `INR (₹)` — the only choice consistent with the data model — but no Decision Log entry records that the built UI will deliberately show a different example currency than the visual reference.
- **Severity:** meets no Blocking condition — Phase 6 UI Review is where visual/example-value deviations like this get explicitly confirmed or reconciled, per the Severity carve-out for "values that Phase 6 UI Review checks anyway."
- **Suggested cleanup (non-blocking):** a one-line Decision Log entry (matching the pattern already used for D-16/D-18) noting the mockup's `INR` is superseded by the FDS enum's `NPR` would save Phase 6 a double-take.

### A-3 — `BE-04`'s own test cross-reference doesn't name the test that actually exercises it

- **Where:** `plan.md` BE-04 ("Done when: the method exists and is covered by a repository test alongside the existing `UserRepository` tests. Tests: T-UA-10 (cross-feature regression — existing `auth` tests still pass unmodified).").
- T-UA-10 only confirms _existing, unmodified_ `auth` tests keep passing — it asserts nothing about the new `updateName` method itself. The test that actually exercises `updateName`'s effect (a `name` update persisting through `ProfileService.updateProfile`) is T-UA-04, which BE-04 doesn't cite.
- **Why this is Advisory, not Blocking:** T-UA-04 exists and does cover the behavior (point 5, Testability, is satisfied overall), so there is no actual coverage gap — only a misleading cross-reference inside BE-04's own "Done when" clause that could confuse whoever implements or verifies this task.
- **Suggested cleanup (non-blocking):** add `T-UA-04` to BE-04's `Tests:` line alongside `T-UA-10`.

---

## Checklist Summary

1. **Coverage** — Pass. Every REQ-PROF-01…04 item, `fds.md` §4 validation rule, and `behavior.md` §1–§5 behavior maps to at least one plan task; §7 Spec Traceability Matrix confirms this end to end.
2. **Traceability** — Pass. Every BE/FE/INT/T task cites a Requirement ID, FDS section, directive, or Decision Log entry.
3. **Cross-section consistency** — Pass, with A-1 noted. Toast copy, warning copy, error codes, status codes, and field shapes now agree verbatim across `behavior.md`, `FE-05`/`FE-07`, `T-UI-04`/`T-UI-07`, and `contract.md` §5.3/§5.5 (the Round 3 `T-UI-07` mismatch is fully resolved, confirmed by a repository-wide text search — no stale "financial records"/"transactions, budgets, goals" copy remains anywhere outside the explicitly-scoped D-18 addenda describing future, not current, behavior).
4. **Rule compliance** — Pass. No new libraries (checkbox, alert-dialog, strong-password reuse all explicitly justified against `rules/tech-stack.md`); layering follows `rules/architecture.md` throughout; `DisplayName`'s dedicated rule set avoids `rules/conventions.md` "Duplication" concerns via its own justification (D-09).
5. **Testability** — Pass, with A-3 noted. Every requirement with an implementation task has at least one corresponding unit/API or component/E2E test; the D-17 rate-limit boundary and D-05 ignored-fields behavior both have explicit boundary-case tests (T-UA-02, T-UA-04, T-UA-09).
6. **Ambiguity carried forward** — Pass. No spec gap found that the plan resolved by silent, undocumented assumption; every judgment call traces to a starred Decision Log entry or an approved directive (D-01 through D-18).
7. **API Contract completeness** — Pass. `contract.md` specifies every route, request/response shape, status, and error code implied by the Frontend/Backend sections, stays technology-agnostic prose throughout (no ts-rest/Zod/framework code), and §8 confirms no items are left Blocking for this review.
8. **Executability** — Pass. Path ownership is unambiguous (Backend: `backend/`, `packages/contracts/`; Frontend: `frontend/`; Integration: wiring only in both, plus an unmodified reference to `e2e/support/auth.ts`); no task crosses its phase's boundary; every dependency (constants module, shared rule-set reuse, `createApp()` wiring) has a named owner before the phase that needs it.

---

## Outside Plan Scope

None noted.
