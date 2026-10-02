# Backend Fragment — `profile` v1.0.0

> **SUPERSEDED.** Stale after revision 4. Kept as an audit trail only; do not use as synthesis input. The authoritative sources are `../plan.md` and `../contract.md`.

Scope: Backend + Backend-Testing only (data model, repositories, services, validation rules,
route intents as plain field/rule lists, and unit/API test requirements). No formal API contract,
no Frontend, no Integration content. A separate Frontend Fragment is being drafted independently;
this fragment does not assume or depend on its contents.

## 0. Directive Application

- **D-01 applied.** `exportUserData` and `clearAllUserData` are scoped to profile-owned data only
  for v1.0.0 (no `transactions`/`budget`/`goals` tables exist yet; those features depend on
  `profile`, per `features/index.json`). Details in §5.3 and §5.4.
- **D-02 (email not editable in Edit Profile dialog) is frontend-scoped and is NOT applied here.**
  It is noted only because it is independently consistent with this fragment: `fds.md` §5's
  `updateUserProfile` request body (`name`, `avatarUrl`, `notificationPreferences`) never included
  `email`, so the backend already excludes `email` from the update surface on its own reading of
  the FDS, not because of D-02.

## 1. Cross-Feature Integration with `auth` (dependency wiring, no auth-file edits)

`features/index.json` declares `profile` depends on `auth`. `fds.md` §2's `UserProfile.name` and
`.email` are owned by the existing `users` table (`backend/src/db/schema/auth.ts`); `profile` does
not duplicate them. To avoid any edits to frozen `auth` feature files:

- **Lazy profile provisioning.** There is no hook into `AuthService.register` /
  `signInWithGoogle` to create a profile row at account-creation time (that would require editing
  `auth-service.ts`, which this fragment does not touch). Instead, `ProfileService` resolves a
  user's profile row on first access via `getOrCreateProfile(userId)`: look up by `userId`; if
  absent, insert one with the baseline defaults from `fds.md` §2
  (`preferredCurrency: "NPR"`, `language: "en_US"`, `monthlyStartDate: 1`, all three
  `notificationPreferences` booleans `true`, `avatarUrl: null`). This satisfies the Overview's
  "initialized to system defaults upon profile creation" without an auth-side hook. **Flagged for
  Synthesizer/Integration confirmation — see §9.**
- **Reused auth repositories.** `ProfileService` is constructed with the existing
  `AuthPersistence` unit of work (`backend/src/features/auth/auth-persistence.ts`) for the two
  operations that touch auth-owned data:
  - Reading `name`/`email`/`passwordHash` via `persistence.users.findById(userId)`.
  - Updating the password hash via `persistence.users.updatePasswordHash(...)` (existing method,
    unchanged).
  - Revoking all sessions on password change via `persistence.refreshTokens.revokeAllForUser(...)`
    (existing method, already used by `password-reset-service.ts`, unchanged).
  - Running the password-change persistence step inside `persistence.runInTransaction(...)`
    (existing method, unchanged).
    No new methods and no edits are required on `UserRepository`, `RefreshTokenRepository`, or
    `AuthPersistence`. `auth-service.ts`, `auth-router.ts`, `auth-errors.ts` are untouched.

## 2. Data Model / Drizzle Schema Changes

New file `backend/src/db/schema/profile.ts` (new schema module, mirrors `auth.ts`), exported from
`backend/src/db/schema/index.ts` alongside the existing `export * from "./auth"`.

### 2.1 `user_profiles` (one row per user)

| Column                               | Type (Drizzle)                                      | Notes                                                                                                                                                                                       |
| :----------------------------------- | :-------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                 | `text` PK                                           | UUID generated in code, same convention as `users.id`                                                                                                                                       |
| `user_id`                            | `text` NOT NULL, FK → `users.id`, `UNIQUE`, cascade | Enforces one profile per user; cascades on user delete                                                                                                                                      |
| `avatar_url`                         | `text` NULL                                         | Free-form string (URL or local path); FDS gives no further format rule                                                                                                                      |
| `preferred_currency`                 | `text` enum (`NPR`,`USD`,`EUR`,`GBP`) NOT NULL      | Default `"NPR"`                                                                                                                                                                             |
| `language`                           | `text` enum (`en_US`,`en_GB`,`es`,`fr`) NOT NULL    | Default `"en_US"`                                                                                                                                                                           |
| `monthly_start_date`                 | `integer` NOT NULL                                  | Default `1`; CHECK `1 <= monthly_start_date <= 28` (drizzle-kit does not emit CHECK automatically — hand-add to generated migration, same pattern as `users_credential_check` in `auth.ts`) |
| `notification_budget_limit_alerts`   | `integer` (boolean) NOT NULL                        | Default `1` (true)                                                                                                                                                                          |
| `notification_goal_reminders`        | `integer` (boolean) NOT NULL                        | Default `1` (true)                                                                                                                                                                          |
| `notification_weekly_summary_emails` | `integer` (boolean) NOT NULL                        | Default `1` (true)                                                                                                                                                                          |
| `created_at`                         | `text` ISO timestamp NOT NULL                       |                                                                                                                                                                                             |
| `updated_at`                         | `text` ISO timestamp NOT NULL                       |                                                                                                                                                                                             |

Index: `user_profiles_user_id_idx` on `user_id` (lookup path for every profile operation).

### 2.2 `password_change_attempts` (rate-limit ledger for `changePassword`)

| Column         | Type (Drizzle)                            | Notes                                                       |
| :------------- | :---------------------------------------- | :---------------------------------------------------------- |
| `id`           | `text` PK                                 | UUID                                                        |
| `user_id`      | `text` NOT NULL, FK → `users.id`, cascade |                                                             |
| `attempted_at` | `text` ISO timestamp NOT NULL             | Recorded only for **failed** credential attempts (see §5.2) |

Index: `password_change_attempts_user_id_idx` on `(user_id, attempted_at)` — supports the rolling
15-minute window count query.

No existing table (`users`, `refresh_tokens`, `password_reset_tokens`) is modified.

## 3. Repository Layer

New file `backend/src/features/profile/profile-repository.ts`:

- `findByUserId(userId: string): ProfileRecord | null`
- `create(newProfile: NewProfile): ProfileRecord` — inserts the baseline-default row described in §1.
- `update(userId: string, patch: ProfilePatch): ProfileRecord` — partial update of
  `avatarUrl` / notification flags only (never `preferredCurrency`, `language`,
  `monthlyStartDate`, per REQ-PROF-02's v1.0.0 read-only scope).
- `resetToDefaults(userId: string, updatedAt: Date): ProfileRecord` — used by `clearAllUserData`;
  writes back the same baseline defaults as `create`, keeps the same row (does not delete/recreate
  it, so `id`/`createdAt` are preserved).

New file `backend/src/features/profile/password-change-attempt-repository.ts`:

- `recordFailure(userId: string, attemptedAt: Date): void`
- `countFailuresSince(userId: string, since: Date): number` — `COUNT(*) WHERE user_id = ? AND attempted_at > ?`.

New file `backend/src/features/profile/profile-persistence.ts` — unit of work mirroring
`AuthPersistence`, exposing `profiles` and `passwordChangeAttempts` repositories plus
`runInTransaction`, for symmetry with the existing auth pattern (`rules/conventions.md` "follow
existing project patterns").

Both repositories follow existing conventions: intention-revealing methods only, no business
rules, Drizzle ORM encapsulated entirely inside the repository (per `rules/architecture.md`
Repository Layer rules).

## 4. Service Layer

New file `backend/src/features/profile/profile-service.ts`, constructed with:
`profilePersistence: ProfilePersistence`, `authPersistence: AuthPersistence` (existing, reused
per §1), `passwordHasher: PasswordHasher` (existing port, reused), `clock: Clock`.

### 4.1 `getProfile(userId): UserProfile`

- `getOrCreateProfile(userId)` (§1) to obtain the profile row.
- `authPersistence.users.findById(userId)` for `name`/`email` (the user must exist — the caller is
  already authenticated by `requireAuth`).
- Assembles and returns the full `UserProfile` shape per `fds.md` §2. **Resolved design decision:**
  the `id` field in the returned object is the **user's id** (same id space as `PublicUser.id` from
  the `auth` feature), not the internal `user_profiles.id` surrogate key — there is exactly one
  profile per user, and this keeps profile identity consistent with the id already known to the
  frontend from `auth`'s `getCurrentUser`. Flagged for Synthesizer confirmation (§9).

### 4.2 `updateProfile(userId, input): UserProfile`

- `input`: `name?`, `avatarUrl?`, `notificationPreferences?` (each of
  `budgetLimitAlerts` / `goalReminders` / `weeklySummaryEmails` itself optional).
  **Resolved design decision:** all fields and all nested notification keys are optional
  (`undefined` = "leave unchanged"), so one PATCH endpoint serves both the "Edit Profile" dialog
  (sends `name` + `avatarUrl`) and a single notification-toggle flip (sends one
  `notificationPreferences` key) per `behavior.md` §2 and §3, without needing two endpoints. The
  FDS declares only one `updateUserProfile` operation, so this is the backend's resolution for how
  that one operation serves both UI interactions. Flagged for Synthesizer confirmation (§9).
- `name`, when provided: update on the **auth** `users.name` column — **open question, not
  resolved here, see §9** (the `users` table in `auth.ts` has no separate "display name used by
  profile" column; `name` is `users.name` itself). This fragment treats `updateProfile`'s `name`
  write as `authPersistence.users.updateName(...)`, a **new method this fragment proposes adding
  to `UserRepository`** (no existing method updates `name`). This is the one place this fragment
  asks for a small addition to the `auth` feature's repository (a focused, intention-revealing
  method, not a schema change) rather than a re-read of `fds.md`/`behavior.md` to avoid a stop —
  see §9 for why this was resolved as an addition rather than an escalation.
- `avatarUrl`, when provided: validated non-empty if present (empty string is rejected the same way
  as absent is accepted — i.e. explicit empty string clears nothing; FDS gives no further format
  rule), written to `user_profiles.avatar_url`.
- `notificationPreferences.*`, when provided: boolean, written to the corresponding column.
- `preferredCurrency`, `language`, `monthlyStartDate` are never accepted by this operation in
  v1.0.0 (REQ-PROF-02); the service does not read them even if present on the input type.
- Returns the refreshed `UserProfile` (same assembly as §4.1).

### 4.3 `changePassword(userId, input): void`

`input`: `currentPassword`, `newPassword`, `confirmPassword`.

Order of checks (service-layer, authoritative per `rules/architecture.md` "server-side validation
is authoritative"):

1. **Rate limit.** `passwordChangeAttempts.countFailuresSince(userId, now - 15min)`. If `>= 5` →
   throw `RateLimitExceededError` (`429 RATE_LIMIT_EXCEEDED`). Checked first, before any credential
   work, so a locked-out user cannot burn further attempts.
2. **Account state.** `authPersistence.users.findById(userId)`. If `passwordHash === null`
   (Google SSO, no password set) → throw `PasswordNotSetError` (`400 PASSWORD_NOT_SET`). **Resolved
   design decision:** this does not count as a "failed attempt" for rate-limiting purposes (it is
   an account-state condition, not a wrong-password guess) — not recorded in
   `password_change_attempts`.
3. **Credential check.** `passwordHasher.verify(user.passwordHash, input.currentPassword)`. If
   invalid → `passwordChangeAttempts.recordFailure(userId, now)`, then throw
   `InvalidCredentialsError` (`401 INVALID_CREDENTIALS`).
4. **Same-password check.** If `input.newPassword === input.currentPassword` → throw
   `SamePasswordError` (`400 SAME_PASSWORD`). Plain string comparison, no hashing needed (current
   password is already known-correct from step 3).
5. **Confirmation match.** If `input.confirmPassword !== input.newPassword` → throw
   `PasswordsDoNotMatchError` (`400 PASSWORDS_DO_NOT_MATCH`). **Note for Synthesizer (§9):**
   `fds.md` §5's error table lists `PASSWORDS_DO_NOT_MATCH` as its own code, distinct from
   `VALIDATION_ERROR` — unlike the `auth` feature, which reports its own confirm-password mismatch
   (sign-up / reset-password) as a generic `VALIDATION_ERROR` field issue via
   `auth-validation.ts`'s `checkPasswordsMatch`. That existing helper/pattern therefore cannot be
   reused as-is for this field if the distinct code is to surface; this fragment enforces the
   distinct code at the service layer instead, after complexity validation (which can still happen
   at the contract/Zod layer, reusing `strongPasswordSchema`'s rules for `newPassword`).
6. **Persist.** Hash `newPassword` (existing `passwordHasher.hash`), then
   `authPersistence.runInTransaction((repos) => { repos.users.updatePasswordHash(userId, hash, now); repos.refreshTokens.revokeAllForUser(userId, now); })`
   — both existing, unchanged methods.
7. Return success (presentation layer returns `{ success: true, message }`).

### 4.4 `exportProfileData(userId): ProfileExportPayload`

Per **D-01**: packages profile-owned fields only. `getOrCreateProfile` + `users.findById`, returns
a plain object with exactly: `id` (user id, same convention as §4.1), `name`, `email`,
`avatarUrl`, `preferredCurrency`, `language`, `monthlyStartDate`, `notificationPreferences`,
`createdAt`, `updatedAt`. No `transactions`/`budgets`/`goals` keys exist on this payload in
v1.0.0 — there is nothing to omit from a table that does not exist, but the service's return type
should be explicitly narrow (not a generic "all user data" blob) so a future `transactions` /
`budget` / `goals` extension is an additive change to this method, not a cleanup of
over-broad scope. **Resolved design decision:** the export is serialized as a downloadable
**JSON** file (`fds.md` REQ-PROF-03 allows "JSON or CSV archive"; JSON is the natural fit for a
single nested object with no tabular rows to export in v1.0.0). Setting the
`Content-Disposition: attachment; filename="profile-export-<ISO-date>.json"` header is a
**Presentation**-layer concern (the service returns data only, per
`rules/architecture.md` layering), not performed by `ProfileService`.

### 4.5 `clearAllUserData(userId): void`

Per **D-01**: resets profile-level configuration/preferences to baseline defaults; does **not**
touch `transactions`/`budgets`/`goals` (deferred to those features' own future work per the
directive) and does **not** touch `users` (name, email, passwordHash untouched — "retaining the
base auth credentials").

- `profilePersistence.profiles.resetToDefaults(userId, now)` — same baseline values as §1/§3.1.
- Returns success (presentation layer returns `{ success: true, message }`; exact message string
  is not specified by `fds.md`'s API table — **resolved design decision:** reuse the existing
  project convention of a named constant, e.g. `PROFILE_DATA_CLEARED_MESSAGE`, analogous to
  `FORGOT_PASSWORD_ACK_MESSAGE` in `auth-constants.ts`. Exact wording left to Synthesizer/Build.)

## 5. Proposed Routes (field lists and rules — not a formal contract)

All five routes require authentication (reuse the existing `requireAuth` middleware /
`getAuthenticatedUserId` helper from `backend/src/features/auth/require-auth.ts`, wired the same
way `getCurrentUser` is wired in `auth-router.ts` — no changes to that file needed, it is imported
by the new profile router the same way `app.ts` already imports and wires auth pieces).

### 5.1 `getUserProfile` — intent: read the caller's full profile

- Reads: nothing (userId from the authenticated session only).
- Writes: nothing, except the implicit lazy-create-on-first-access described in §1 (a `201`-worthy
  side effect on a `GET`; **flagged for Synthesizer §9** — lazy creation on a `GET` is a mild
  layering smell worth a second look at Integration time, even though it is otherwise the
  least invasive option available without touching `auth`).
- Returns: full `UserProfile` object (§4.1).
- Errors: `401 UNAUTHENTICATED` (missing/invalid/expired bearer token, via existing middleware).

### 5.2 `updateUserProfile` — intent: edit display name, avatar, and/or notification toggles

- Reads: current profile + user row (to merge partial input).
- Writes (all optional, see §4.2): `name` (→ `users.name`, pending the new repository method,
  §4.2/§9), `avatarUrl` (→ `user_profiles.avatar_url`), `notificationPreferences.budgetLimitAlerts`,
  `.goalReminders`, `.weeklySummaryEmails` (→ their respective columns).
- Validation: `name` 2–100 characters if provided (`fds.md` §4); notification values must be
  boolean if provided; `preferredCurrency`/`language`/`monthlyStartDate` are rejected/ignored if
  present (REQ-PROF-02 v1.0.0 scope); `email` is never an accepted field (not in the FDS §5 request
  body, independent of D-02).
- Returns: full refreshed `UserProfile` object.
- Errors: `400 VALIDATION_ERROR` (name length, wrong types), `401 UNAUTHENTICATED`.

### 5.3 `changePassword` — intent: update the caller's login password

- Reads: `currentPassword`, `newPassword`, `confirmPassword`.
- Writes: `users.passwordHash` (hashed), revokes all of the user's refresh tokens, records a
  failed-attempt row on credential failure (§4.3).
- Validation/business rules (§4.3, in order): rate limit (5 failures / rolling 15 min →
  `429 RATE_LIMIT_EXCEEDED`), account must have a password set (Google-SSO-only accounts →
  `400 PASSWORD_NOT_SET`), `currentPassword` must match (`401 INVALID_CREDENTIALS`), `newPassword`
  complexity ≥ 8 chars + 1 digit + 1 special character (`400 VALIDATION_ERROR`), `newPassword` ≠
  `currentPassword` (`400 SAME_PASSWORD`), `confirmPassword` must equal `newPassword`
  (`400 PASSWORDS_DO_NOT_MATCH`).
- Returns: `{ success: true, message }`.
- Errors: all of the above, plus `401 UNAUTHENTICATED`.

### 5.4 `exportUserData` — intent: download the caller's profile-owned data (D-01 scope)

- Reads: profile + user row.
- Writes: nothing (implicit lazy-create per §1 applies here too, same as §5.1).
- Returns: downloadable JSON archive (§4.4) containing exactly the D-01-scoped field list; **no**
  transaction/budget/goal data (those tables do not exist in v1.0.0).
- Errors: `401 UNAUTHENTICATED`.

### 5.5 `clearAllUserData` — intent: reset profile configuration to baseline (D-01 scope)

- Reads: `confirmation` (must be the exact literal string `"DELETE"`).
- Writes: resets `user_profiles` row to baseline defaults (§4.5). Does **not** write to `users`
  and does **not** touch any transaction/budget/goal table (none exist yet; D-01 defers that hook).
- Validation: `confirmation !== "DELETE"` → `400 VALIDATION_ERROR` (reuse the generic code; no
  dedicated code is listed for this in `fds.md` §5's error table, so a literal-mismatch Zod issue
  is sufficient and consistent).
- Returns: `{ success: true, message }`.
- Errors: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`.

## 6. Validation Rules Summary (from `fds.md` §4, mapped to layers)

| Rule                                | Field(s)                        | Authoritative layer                                                                                                                                                                        |
| :---------------------------------- | :------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2–100 characters                    | `name`                          | Service (also recommend contract/Zod for fast feedback, same pattern as `auth`'s `nameSchema`)                                                                                             |
| Valid email format                  | `email`                         | N/A for writes — `email` is never writable through `profile` endpoints                                                                                                                     |
| Integer 1–28                        | `monthlyStartDate`              | N/A for writes in v1.0.0 — field is read-only (REQ-PROF-02); DB `CHECK` constraint still guards the column for the baseline-default inserts/resets                                         |
| Exact literal `"DELETE"`            | `clearAllUserData.confirmation` | Contract/Zod (`z.literal("DELETE")`)                                                                                                                                                       |
| ≥8 chars, 1 digit, 1 special char   | `newPassword`                   | Contract/Zod — reuse `strongPasswordSchema`'s rule logic from `packages/contracts/src/auth/auth-validation.ts` rather than redefining it (`rules/conventions.md` "avoid duplicated logic") |
| Must differ from `currentPassword`  | `newPassword`                   | Service (`SamePasswordError`), §4.3 step 4                                                                                                                                                 |
| Must equal `newPassword`            | `confirmPassword`               | Service (`PasswordsDoNotMatchError`), §4.3 step 5 — see the §9 note on why this cannot simply reuse `auth`'s `checkPasswordsMatch` helper                                                  |
| Must match stored hash              | `currentPassword`               | Service (`InvalidCredentialsError`), §4.3 step 3                                                                                                                                           |
| Account must have a password        | (SSO guard)                     | Service (`PasswordNotSetError`), §4.3 step 2                                                                                                                                               |
| ≤5 failed attempts / rolling 15 min | `changePassword` (per user)     | Service (`RateLimitExceededError`), §4.3 step 1                                                                                                                                            |

## 7. New Error Codes Needed

`fds.md` §5's error table requires four codes not yet in
`packages/contracts/src/common/error-body.ts`'s `ERROR_CODES` catalog:

| Code                     | HTTP status | New `DomainError` subclass (new file `backend/src/features/profile/profile-errors.ts`, mirrors `auth-errors.ts`) |
| :----------------------- | :---------- | :--------------------------------------------------------------------------------------------------------------- |
| `PASSWORD_NOT_SET`       | 400         | `PasswordNotSetError`                                                                                            |
| `SAME_PASSWORD`          | 400         | `SamePasswordError`                                                                                              |
| `PASSWORDS_DO_NOT_MATCH` | 400         | `PasswordsDoNotMatchError`                                                                                       |
| `RATE_LIMIT_EXCEEDED`    | 429         | `RateLimitExceededError`                                                                                         |

These four need entries added to `ERROR_CODES`, `ERROR_MESSAGES` (both in
`packages/contracts/src/common/error-body.ts`) and `ERROR_STATUS` (in
`backend/src/shared/errors/error-handler.ts`) — both files are shared/cross-feature but live under
`backend/` and `packages/contracts`, within this phase's path boundary. No existing code's status
or message changes.

## 8. Resolved Design Decisions (self-resolved this attempt — not escalated)

These are documented here, distinctly from blocking ambiguities, because each was resolvable from
the existing FDS/behavior/directives/rules without inventing requirements:

1. Lazy profile-row creation on first read/write, instead of an `auth`-side hook (§1).
2. `UserProfile.id` in API responses = the user's id, not a separate profile surrogate key (§4.1).
3. `updateUserProfile` treats all top-level and nested fields as optional/partial (§4.2).
4. Export format is JSON, not CSV (§4.4).
5. `clearAllUserData`'s literal-mismatch and `confirmAllUserData`'s success message are handled via
   existing generic patterns (`VALIDATION_ERROR` reuse; named-constant message) rather than new
   dedicated mechanisms (§4.5, §5.5).

## 9. Flagged for Synthesizer / Integration — non-blocking, but needs a decision recorded

1. **`name` updates require one new method on `auth`'s `UserRepository`.** No existing method
   updates `users.name` (only `updatePasswordHash` and `linkGoogleId` exist). This fragment
   proposes adding `UserRepository.updateName(userId: string, name: string, updatedAt: Date): void`
   — a small, additive, intention-revealing method, not a schema or behavior change to any
   existing method, and `auth-service.ts`/`auth-router.ts`/`auth-errors.ts` stay untouched. This
   is called out explicitly rather than silently assumed, since it is the one place this fragment's
   scope reaches (lightly) into a file outside `backend/src/features/profile/`.
2. Lazy profile-row creation on a `GET` (`getUserProfile`, `exportUserData`) is a minor layering
   smell (a read endpoint has a write side effect). Confirm at Integration whether this is
   acceptable or whether the Synthesizer prefers a different provisioning trigger once both
   fragments are visible.
3. Confirm the partial/merge semantics for `updateUserProfile` (§4.2, resolution #3) match what the
   Frontend Fragment's "Edit Profile" dialog and notification toggles actually send.
4. Exact success-message strings for `exportUserData`'s toast-triggering response and
   `clearAllUserData`'s `message` field are not specified in `fds.md`'s API table (only
   `behavior.md`'s toast copy, which is frontend-rendered text, not necessarily the literal API
   `message` value). Recommend fixing these as named constants during Build, not during planning.

## 10. Unit Test Requirements (Vitest, Service + Repository layers)

**`ProfileRepository`**

- `findByUserId` returns `null` when no row exists; returns the row after `create`.
- `create` applies exactly the baseline defaults from §1 when fields are omitted.
- `update` only changes the columns passed in the patch; all other columns (including
  `preferredCurrency`/`language`/`monthlyStartDate`) are untouched.
- `resetToDefaults` restores baseline defaults, preserves `id` and `createdAt`, updates
  `updatedAt`.
- Unique constraint on `user_id`: a second `create` for the same user fails (mirrors
  `UserRepository`'s email-uniqueness test pattern in `user-repository.test.ts`).

**`PasswordChangeAttemptRepository`**

- `countFailuresSince` returns `0` with no rows.
- Counts only rows within the rolling window; a failure older than 15 minutes (using `TestClock`-style
  time control, per `auth-test-harness.ts`'s `TestClock.advanceBy`) is excluded.
- Boundary case: a failure exactly at the 15-minute edge is excluded (window is "since", exclusive
  at the far edge, matching `countFailuresSince(userId, now - 15min)` using `>`).

**`ProfileService.getProfile`**

- Creates a profile with baseline defaults on first call for a user with none.
- Returns the same row (no re-creation) on a second call.
- Returned `id` equals the user id (resolution #2).

**`ProfileService.updateProfile`**

- Updating only `avatarUrl` leaves `name` and notification flags unchanged, and vice versa.
- Updating one `notificationPreferences` key leaves the other two unchanged.
- Rejects (or ignores) any attempt to set `preferredCurrency`/`language`/`monthlyStartDate`.
- `name` 2–100 character validation (boundary cases: 1 char rejected, 2 chars accepted, 100 chars
  accepted, 101 chars rejected).

**`ProfileService.changePassword`** (full rule matrix, each as its own test, per
`rules/conventions.md` "tests for business behaviour"):

- Wrong `currentPassword` → `InvalidCredentialsError`, and a failure row is recorded.
- Google-SSO account with `passwordHash === null` → `PasswordNotSetError`, no failure row recorded.
- `newPassword === currentPassword` → `SamePasswordError`.
- `confirmPassword !== newPassword` → `PasswordsDoNotMatchError`.
- 5 recorded failures within 15 minutes → 6th attempt (even with correct credentials) →
  `RateLimitExceededError`.
- A failure recorded 16 minutes ago (via `TestClock.advanceBy`) does not count toward the limit.
- Successful change: `users.passwordHash` updated, all of the user's refresh tokens revoked
  (assert via `RefreshTokenRepository`/`AuthPersistence`), no failure row recorded.

**`ProfileService.exportProfileData`**

- Returned payload contains exactly the D-01 field list — assert the object has no
  `transactions`/`budgets`/`goals` keys (defensive scope test, since those tables don't exist to
  accidentally query).
- Lazily creates the profile if one did not exist yet (same as `getProfile`).

**`ProfileService.clearAllUserData`**

- Resets `user_profiles` columns to baseline defaults.
- Does not modify `users.name` / `users.email` / `users.passwordHash`.
- Rejects a `confirmation` value other than the literal `"DELETE"`.

## 11. API / Integration Test Requirements (route level, extend the `startTestApp` harness pattern from `backend/src/test-support/auth-test-harness.ts`)

- All five routes return `401 UNAUTHENTICATED` with no/invalid/expired Bearer token (reusing the
  existing `requireAuth` behavior already covered by `require-auth.test.ts`; profile adds route
  wiring tests, not new middleware tests).
- `GET /api/v1/profile`: `200` with the full `UserProfile` shape on first call for a fresh user
  (defaults), and on a second call after an update (reflects the update).
- `PATCH /api/v1/profile`: `200` + updated fields reflected; `400 VALIDATION_ERROR` for a 1-character
  `name`; a request that includes `preferredCurrency` is either rejected or silently ignored
  (confirm which, per §9 item 3, and assert that exact behavior once decided).
- `POST /api/v1/profile/change-password`: full status/code matrix from §6/§7 exercised end-to-end
  through the real HTTP layer (`429`, `400` × 3 distinct codes, `401`), plus confirmation that a
  successful change invalidates a previously-issued refresh token (attempt
  `POST /api/v1/auth/refresh` with the old cookie afterward and expect `401`).
- `GET /api/v1/profile/export`: `200`, `Content-Disposition: attachment` header present, JSON body
  parses to exactly the D-01 field list.
- `POST /api/v1/profile/clear-data`: `200` with correct `confirmation`; `400 VALIDATION_ERROR` with
  a wrong/missing `confirmation`; a follow-up `GET /api/v1/profile` shows reset values.
- Cross-feature regression check: existing `auth` route tests
  (`auth-router.test.ts`, `auth-router.cookies.test.ts`) continue to pass unmodified, confirming no
  auth behavior changed.

Coverage note: `fds.md` frontmatter sets `coverage_target: 85` for this feature — relevant to
Phase 8c's SonarQube Full Quality Gate (`rules/workflow.md` §7), not actioned in this planning
fragment but worth carrying forward into Build/Test Build Mode task sizing.
