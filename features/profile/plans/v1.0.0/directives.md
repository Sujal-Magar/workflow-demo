# Directives: profile v1.0.0

## Pre-Planning Directives (Developer Decisions)

### D-01 Scope of Data Export and Clear Data Endpoints (Backend Dependency Resolution)

- **Context / Finding**:
  The Phase 1 Backend Plan Fragment stopped because `fds.md` REQ-PROF-03 (`exportUserData`) and REQ-PROF-04 (`clearAllUserData`), along with `behavior.md` §5, specify exporting and wiping financial records (transactions, budgets, and goals). However, those tables do not exist yet (`backend/src/db/schema/` only defines `users`, `refresh_tokens`, and `password_reset_tokens`), and `features/index.json` specifies that `transactions`, `budget`, and `goals` depend on `profile` being built first. Inverting dependencies in `features/index.json` would introduce architectural circularity, as financial modules depend on profile configurations (`preferredCurrency`, `monthlyStartDate`).
- **Options Considered**:
  - **Option A**: Invert or resequence the dependency graph in `features/index.json` and `fds.md` frontmatter so transactions, budget, and goals are implemented prior to shipping `profile` v1.0.0. (Rejected: breaks foundational module sequencing; subsequent features depend on user-level preferences established by profile).
  - **Option B**: Scope `exportUserData` (`GET /api/v1/profile/export`) and `clearAllUserData` (`POST /api/v1/profile/clear-data`) down to profile-owned data only for v1.0.0, deferring the cross-feature financial record wipe/export to those features' own future work. (Approved).
- **Decision**:
  Option B. For `profile` v1.0.0:
  - `exportUserData` (`GET /api/v1/profile/export`): Packages and exports profile-owned data only (`UserProfile`: `name`, `email`, `avatarUrl`, `preferredCurrency`, `language`, `monthlyStartDate`, `notificationPreferences`, and timestamps). As subsequent features (`transactions`, `budget`, `goals`) are developed, they will extend this export mechanism or register their records into the export archive.
  - `clearAllUserData` (`POST /api/v1/profile/clear-data`): In v1.0.0, resets profile-level configurations/preferences to baseline defaults while retaining base authentication credentials. Cross-feature ledger data purging (transactions, budgets, goals) will be hooked into this flow when those features are implemented.
- **Apply to**:
  - Backend Fragment (`v1.0.0/fragments/backend.md`): Scope schema, service logic, routes, and tests for `exportUserData` and `clearAllUserData` to profile-owned records only.
  - Plan Synthesizer (`v1.0.0/plan.md` and `contract.md`).
- **Record as a starred (★) decision in the plan's Decision Log**: Yes.

### D-02 Scope of Edit Profile Dialog (Email Editability)

- **Context / Finding**:
  `behavior.md` §2 originally referenced opening an edit dialog for "display name, email, and avatar upload", whereas `fds.md` §5 (`updateUserProfile` request body: `name, avatarUrl, notificationPreferences`) and §6 scoped user updates to display name and avatar without email.
- **Decision**:
  The "Edit Profile" dialog does NOT permit modifying the user's email address. User email represents the unique account credential established during authentication (`auth` feature). The "Edit Profile" dialog allows editing display name and avatar upload only. `behavior.md` §2 and `fds.md` §6 note have been updated to reflect this.
- **Apply to**:
  - Frontend Fragment (`v1.0.0/fragments/frontend.md`): Form fields, validation, and write intents for the Edit Profile modal.
  - Plan Synthesizer (`v1.0.0/plan.md` and `contract.md`).
- **Record as a starred (★) decision in the plan's Decision Log**: Yes.

## Revision Directives (Plan Review Round 1, `v1.0.0/review.md`)

### D-16 Ownership of the nav-header entry point to `/profile` (`behavior.md` §1)

- **Context / Finding**: Plan Review finding B-2. `behavior.md` §1 describes "Clicking the User Profile avatar icon in the top right of the navigation header navigates to `/profile`," but no shared navigation header exists anywhere in `frontend/src` yet (confirmed: `frontend/src/app/(protected)/layout.tsx` only wraps children in `ProtectedRoute`). `plan.md` Decision Log D-13 excludes building it from this feature's scope, but D-13 was unstarred — a unilateral Plan Synthesizer choice never routed through this file for developer sign-off — and no addendum documents the exclusion against `behavior.md` §1 itself.
- **Options Considered**:
  - **Option A**: Add a small task to FE-02 building just the avatar-icon link (not a full shared nav bar) inside `profile`'s own page shell, satisfying `behavior.md` §1 literally without claiming ownership of navigation on other pages.
  - **Option B**: Confirm D-13 as a starred decision and add a short addendum to `behavior.md` §1 noting the shared navigation header (which must render identically across `/dashboard`, `/transactions`, etc. — see `features/dashboard/behavior.md`'s "primary top navigation active tab") is owned by a future cross-feature/app-shell effort, not by `profile`. This is the Clarification path in `rules/workflow.md` §4: an addendum, no restart. (Approved).
- **Decision**:
  Option B. `profile` v1.0.0 does not build the shared navigation header or the avatar-icon entry point. `behavior.md` §1 gets a short addendum noting this is deferred to a future cross-feature/app-shell effort. `plan.md` Decision Log D-13 is confirmed as a starred (★) decision on that basis.
- **Apply to**:
  - `behavior.md` §1: addendum noting the shared nav header is a future cross-feature/app-shell concern.
  - Plan Synthesizer (`v1.0.0/plan.md` Decision Log D-13, starred; Spec Traceability Matrix).
- **Record as a starred (★) decision in the plan's Decision Log**: Yes (D-13).

## Revision Directives (Plan Review Round 2, `v1.0.0/review.md`)

### D-17 Rate-limit window boundary inclusivity (`changePassword`, `fds.md` §4)

- **Context / Finding**: Plan Review finding B-2. `fds.md` §4's "rolling 15-minute window" does not say whether a failure exactly 15 minutes old still counts toward the 5-failure threshold. `plan.md` T-UA-02 assumed it does not, without a recorded decision.
- **Options Considered**:
  - **Option A**: Exclusive boundary — a failure exactly 15:00 old no longer counts (current `T-UA-02` assumption; `countFailuresSince` would use `attemptedAt > since`).
  - **Option B**: Inclusive boundary — a failure exactly 15:00 old still counts (`countFailuresSince` would use `attemptedAt >= since`).
- **Decision**:
  Option A. Exclusive boundary — a failure exactly 15:00 old no longer counts toward the rate limit (`countFailuresSince` uses `attemptedAt > since`).
- **Apply to**:
  - `plan.md` Decision Log: add D-17 (starred).
  - `plan.md` BE-05: `PasswordChangeAttemptRepository.countFailuresSince` semantics (`attempted_at > since`).
  - `plan.md` BE-07: service-layer check semantics (`attempted_at > now - 15min`).
  - `plan.md` T-UA-02: explicit boundary test trace and coverage.
  - `contract.md` §3: `RATE_LIMIT_EXCEEDED` error definition.
- **Record as a starred (★) decision in the plan's Decision Log**: Yes.

## Revision Directives (Plan Review Round 3, `v1.0.0/review.md`)

### D-18 v1.0.0 UI/spec copy for the D-01-scoped Export Data and Clear All Data actions

- **Context / Finding**: Plan Review findings B-1, B-2. `fds.md` REQ-PROF-03, REQ-PROF-04 and §6, and `behavior.md` §4/§5, describe export/clear actions against transactions, budgets, and goals. Directive D-01 already scoped both actions to profile-owned data only for v1.0.0 (those tables don't exist yet), but no addendum updated that spec text or the user-facing modal/toast copy to match — unlike D-16's addendum treatment of `behavior.md` §1 for an analogous gap. Built as written, "Clear All Data" promised deletion of financial records it would never touch, and "Export Data" was documented as a financial-history export that would contain none.
- **Options Considered**:
  - **Option A**: Addend `fds.md` REQ-PROF-03/REQ-PROF-04/§6 and rewrite `behavior.md` §4/§5's literal copy to describe the v1.0.0 profile-only scope, with each addendum noting the scope expands once `transactions`/`budget`/`goals` are built (directive D-01). (Approved)
  - **Option B**: Keep the current forward-looking copy unchanged and accept that it's inaccurate until those features land. (Rejected — a high-severity destructive-action confirmation that overstates its own blast radius is a trust problem in production, and it leaves REQ-PROF-03/REQ-PROF-04's acceptance criteria permanently unsatisfiable in v1.0.0 even though the approved implementation is otherwise correct.)
- **Decision**:
  Option A. `fds.md` REQ-PROF-03, REQ-PROF-04 and the two affected §6 acceptance-criterion bullets, and `behavior.md` §4 (export success toast) and §5 (modal warning copy and success toast), are addended to describe v1.0.0's actual profile-only scope, each noting the scope expands once `transactions`/`budget`/`goals` exist (directive D-01).
- **Apply to**:
  - `fds.md` REQ-PROF-03, REQ-PROF-04, §6 (the two affected acceptance-criterion bullets): addenda.
  - `behavior.md` §4 (export success toast copy), §5 (modal warning copy and success toast copy): addenda / rewritten copy.
  - Plan Synthesizer (`v1.0.0/plan.md`: `FE-07`'s literal-copy instruction, Decision Log cross-reference to D-01, Spec Traceability Matrix; `v1.0.0/contract.md` §6.3/§6.5 `message` text only if it no longer matches the new toast copy).
- **Record as a starred (★) decision in the plan's Decision Log**: Yes.

## Revision Directives (Plan Review Round 4, `v1.0.0/review.md`)

### Authorization to proceed past 3-revision retry bound (rules/workflow.md §8)

- **Context / Finding**: Plan Review Round 3 (`v1.0.0/review.md`) returned CHANGES REQUIRED on Blocking Finding B-1: `plan.md` §6.2 task `T-UI-07` quoted the Clear All Data success toast as `"All financial records have been cleared."`, which contradicts `FE-07`, `behavior.md` §5, and `contract.md` §5.5 (all of which specify `"All profile data has been cleared."`). The plan reached the 3-revision retry bound (`rules/workflow.md` §8), requiring developer authorization before running Revision 4.
- **Decision**: Authorized by developer. Proceed with Revision Round 4 to resolve B-1 by updating `T-UI-07`'s quoted toast text to `"All profile data has been cleared."`.
- **Apply to**:
  - `plan.md` §6.2 task `T-UI-07`: toast text.
  - `plan.md` line 8: provenance line narrative for Round 3 (D-18) and Round 4 (B-1 fix).
  - `fds.md` §5: update API table description column for `exportUserData` and `clearAllUserData` to profile-only scope (closing Advisory finding A-1).
