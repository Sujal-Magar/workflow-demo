# Backend Plan Fragment: Authentication and Identity (`auth`) v1.0.0

> **SUPERSEDED.** Stale after revision 1. Kept as an audit trail only; do not use as synthesis input. The authoritative sources are `../plan.md` and `../contract.md` (revision 3).

Status: draft fragment (input to the Plan Synthesizer). This fragment covers Backend and Backend-Testing only. It is not an API contract; the formal contract is the Synthesizer's job.

Revision: cycle 1 applied the developer-approved directives from the plan review (service-owned workflows with a transaction-runner port, BE-01-first sequencing, repo-root database path, and the backend advisories). Nothing in the FDS changed.

Sources: `features/auth/fds.md` (v1.0.0), `rules/architecture.md`, `rules/conventions.md`, `rules/tech-stack.md`, `features/index.json`, existing `backend/src` and `packages/contracts/src`.

---

## 1. Current Backend State (observed)

- `backend/src/index.ts` is a single file: loads `.env`, builds an Express app inline, hand-written CORS middleware (`Allow-Origin` = `FRONTEND_ORIGIN`, headers `Content-Type` only, no credentials), `GET /health`, and calls `app.listen` at import time.
- No layers, no Drizzle schema, no migrations, no `data/` directory, no ts-rest router, no tests.
- `backend/package.json` already has: `@ts-rest/express`, `better-sqlite3`, `drizzle-orm@^0.33`, `express@^4.21`, `zod`, `drizzle-kit`, `tsx`, `vitest`. Backend compiles to CommonJS (`module: CommonJS`, `rootDir: ./src`).
- `packages/contracts/src/index.ts` is empty (`export {}`); its package already depends on `@ts-rest/core` and `zod`.
- `.env.example` has `PORT`, `FRONTEND_ORIGIN`, `DATABASE_PATH=./data/app.db` only.
- `pnpm-workspace.yaml` has `allowBuilds` for `better-sqlite3` and `esbuild` only.

Consequence: this feature establishes the backend layering pattern for every later feature, so the layout below is deliberately generic where it will be reused (app factory, error mapper, `requireAuth`, DB module).

---

## 2. Dependencies and Configuration

### 2.1 New backend dependencies (all pre-approved in FDS section 2 and `rules/tech-stack.md`)

| Package                | Kind | Constraint                                                   |
| :--------------------- | :--- | :----------------------------------------------------------- |
| `argon2`               | dep  | argon2id; native module                                      |
| `jose`                 | dep  | MUST be `^5.x` (CommonJS backend; later majors are ESM-only) |
| `google-auth-library`  | dep  | ID-token verification                                        |
| `cookie-parser`        | dep  | Express middleware                                           |
| `@types/cookie-parser` | dev  | types only                                                   |

No HTTP test client is added (no `supertest`). No other library is added. Password-reset and refresh tokens are generated with Node's built-in `node:crypto` (`randomBytes`, `createHash`, `randomUUID`); no extra dependency.

### 2.2 Repo files outside `backend/` that the backend work depends on (flag for the Synthesizer)

The Build boundary says Backend Build touches only `backend/` and `packages/contracts/`. These two root-level changes are required and need an owner decided by the Synthesizer (Integration phase or an explicit exemption):

1. `pnpm-workspace.yaml`: add `argon2: true` under `allowBuilds` (FDS section 2 says approving `argon2` includes allowing its build script).
2. Root `.env.example`: add `JWT_SECRET`, `GOOGLE_CLIENT_ID` (see 2.3). The root file keeps backend variables only (`PORT`, `FRONTEND_ORIGIN`, `DATABASE_PATH`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`) and gains one comment pointing to `frontend/.env.example` for the frontend's `NEXT_PUBLIC_*` variables. Frontend variables and `frontend/.env.example` are not a backend concern. (`.env` itself is git-ignored and is not committed.)

### 2.3 Environment variables (read once, in a typed `config` module)

| Variable           | Required | Use                                                                                 | Missing behavior (proposed)                                                                                                                                                                 |
| :----------------- | :------- | :---------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `JWT_SECRET`       | Yes      | HS256 signing key for access tokens                                                 | Fail fast at startup with a clear error. Proposed minimum length 32 characters (HS256 key strength); needs approval.                                                                        |
| `GOOGLE_CLIENT_ID` | No       | Audience check for Google ID tokens                                                 | Server still starts; `googleOAuthLogin` returns `401 INVALID_GOOGLE_TOKEN` (no audience to verify against).                                                                                 |
| `FRONTEND_ORIGIN`  | Existing | CORS allowed origin; base of reset URL `<FRONTEND_ORIGIN>/reset-password?token=...` | Default `http://localhost:3000` (existing behavior).                                                                                                                                        |
| `DATABASE_PATH`    | Existing | SQLite file path                                                                    | Default `./data/app.db`. A relative value is resolved against the repository root (see below), an absolute value is used as-is, `:memory:` is passed through. Parent dir created if absent. |
| `NODE_ENV`         | Existing | `production` adds `Secure` to the refresh cookie                                    | n/a                                                                                                                                                                                         |
| `PORT`             | Existing | listen port                                                                         | 4000                                                                                                                                                                                        |

Database path base: the repository root is the nearest ancestor directory of `process.cwd()` that contains `pnpm-workspace.yaml`, found by walking up. This makes a relative `DATABASE_PATH` land on `<repo>/data/app.db` (as `rules/architecture.md` requires) whether the process runs from `backend/` (`pnpm dev`, the Playwright `webServer`) or from anywhere else in the repo. If no `pnpm-workspace.yaml` is found, fall back to `process.cwd()` (minor choice, see 14). The path resolution is a small pure function in `config/env.ts` and is unit-tested.

The config module reads `process.env` once and passes typed values into constructors; services never read `process.env` directly (keeps them testable and Express-free).

---

## 3. Proposed Backend File Layout

All under `backend/src`, kebab-case files, feature-oriented under `auth/`, shared plumbing at top level. (Contracts additions are listed in section 12 only as needs, not designed here.)

```
backend/src/
  index.ts                         # thin: load env, build config, createApp, listen
  app.ts                           # createApp(deps): builds Express app; no listen (enables ephemeral-port tests)
  config/
    env.ts                         # typed config loader + fail-fast validation
  db/
    client.ts                      # createDatabase(path): better-sqlite3 + drizzle; supports ":memory:"
    migrate.ts                     # applies Drizzle migrations at startup / in tests
    schema/
      users.ts                     # users table
      refresh-tokens.ts            # refresh_tokens table
      password-reset-tokens.ts     # password_reset_tokens table
      index.ts                     # barrel
    migrations/                    # drizzle-kit generated SQL (committed)
  shared/
    domain-error.ts                # DomainError base (code, message)
    clock.ts                       # Clock port (now()) for deterministic expiry tests
  auth/
    domain/
      auth-errors.ts               # typed domain errors (see 6.1)
      auth-types.ts                # AuthUser, SessionTokens, etc. (derived from contract types where they exist)
    ports/
      mailer.ts                    # Mailer port
      google-token-verifier.ts     # GoogleTokenVerifier port
      transaction-runner.ts        # TransactionRunner port: the service-controlled transaction boundary
    infrastructure/
      console-mailer.ts            # ConsoleMailer (logs reset URL)
      google-auth-library-verifier.ts  # google-auth-library adapter
      argon2-password-hasher.ts    # PasswordHasher adapter (argon2id)
      jose-access-token-signer.ts  # AccessTokenSigner adapter (HS256); receives the Clock
    repositories/                  # single-table, no business rules
      user-repository.ts
      refresh-token-repository.ts
      password-reset-token-repository.ts
      drizzle-transaction-runner.ts  # TransactionRunner implementation; opens the Drizzle transaction and hands the service repositories bound to it (kept here so only this folder imports drizzle-orm)
    services/                      # own the rules and the multi-step sequences
      auth-service.ts              # register, login, loginWithGoogle (each returns the full session result), getCurrentUser
      session-service.ts           # issue / rotate / revoke refresh tokens, access token issue+verify
      password-reset-service.ts    # requestReset, resetPassword
    presentation/
      auth-router.ts               # ts-rest router implementation for the 8 routes
      refresh-cookie.ts            # set / clear / read the refresh_token cookie
      require-auth.ts              # requireAuth middleware
      error-mapper.ts              # DomainError -> {status, body{code,message}}
  http/
    request-validation-handler.ts  # ts-rest requestValidationErrorHandler -> shared error shape with fieldErrors
    json-body-guard.ts             # rejects present-but-non-object JSON bodies with the shared 400 (7.6)
    cors.ts                        # CORS middleware (credentials + Authorization header)
```

Tests are colocated as `*.test.ts` next to the unit under test, plus `backend/src/auth/__tests__/auth-api.test.ts` (or `backend/tests/auth-api.test.ts`; Synthesizer/Build to pick one convention and keep it consistent) for API tests.

Layer rule check (architecture.md): Presentation -> Service -> Repository -> Database only. Services depend on repositories and on ports (`Mailer`, `GoogleTokenVerifier`, `PasswordHasher`, `AccessTokenSigner`, `TransactionRunner`, `Clock`) via constructor injection; none import Express, `req`, `res`, cookies, or Drizzle. Only the `repositories/` folder (repositories plus the Drizzle `TransactionRunner` implementation) imports `drizzle-orm`. `argon2`, `jose`, `google-auth-library` are used only inside `infrastructure/` adapters behind ports, so services stay framework-agnostic and unit-testable with fakes.

Compliance with `rules/architecture.md` (Service coordinates multi-step workflows; "Services define transactional intent and boundaries. Repositories execute transactional operations"): the service decides where a transaction starts and ends by calling the `TransactionRunner` port; the repositories it receives inside the boundary are single-table and contain no business rules; all rules and sequences (rotation, reset, reset-token replacement) live in services. No repository method touches more than one table.

---

## 4. Data Model (Drizzle / SQLite)

Naming: table names snake_case plural; TS exports camelCase. IDs are UUID v4 strings (`crypto.randomUUID()`), generated in the service/repository input, stored as `text`. Timestamps are ISO-8601 strings (`text`), consistent with the FDS "ISO Timestamp" type and SQLite's lack of a native timestamp. All timestamp values come from the injected `Clock`.

### 4.1 `users` (FDS `UserAuth`)

| Column          | Type / constraint                           | Notes                                                                    |
| :-------------- | :------------------------------------------ | :----------------------------------------------------------------------- |
| `id`            | text, PK                                    | UUID                                                                     |
| `name`          | text, NOT NULL                              | min 2 chars enforced by validation, not DB                               |
| `email`         | text, NOT NULL, UNIQUE                      | stored lowercase; unique index is the concurrency-safe duplicate guard   |
| `password_hash` | text, NULL                                  | argon2id encoded hash; NULL for Google-only accounts                     |
| `provider`      | text enum (`'email'`, `'google'`), NOT NULL | original creation method; never changed by linking                       |
| `google_id`     | text, NULL, UNIQUE                          | Google `sub`; unique index (SQLite permits many NULLs in a UNIQUE index) |
| `created_at`    | text, NOT NULL                              | ISO                                                                      |
| `updated_at`    | text, NOT NULL                              | ISO; bumped on link and on password set                                  |

Invariant "at least one of `password_hash` / `google_id` is set": enforced by a DB `CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL)` as defence in depth, and by the service (the only creation paths always set one).

### 4.2 `refresh_tokens` (FDS `RefreshToken`)

| Column       | Type / constraint                | Notes                                                 |
| :----------- | :------------------------------- | :---------------------------------------------------- |
| `id`         | text, PK                         | UUID                                                  |
| `user_id`    | text, NOT NULL, FK -> `users.id` | index on `user_id` (revoke-all-for-user)              |
| `token_hash` | text, NOT NULL, UNIQUE           | SHA-256 hex of the raw token; raw token never stored  |
| `expires_at` | text, NOT NULL                   | issue time + 7 days                                   |
| `revoked_at` | text, NULL                       | set on rotation, logout, or password-reset revoke-all |
| `created_at` | text, NOT NULL                   | issue time                                            |

### 4.3 `password_reset_tokens` (FDS `PasswordResetToken`)

| Column       | Type / constraint                | Notes                                                   |
| :----------- | :------------------------------- | :------------------------------------------------------ |
| `id`         | text, PK                         | UUID                                                    |
| `user_id`    | text, NOT NULL, FK -> `users.id` | index on `user_id` (invalidate-earlier-tokens)          |
| `token_hash` | text, NOT NULL, UNIQUE           | SHA-256 hex of raw token                                |
| `expires_at` | text, NOT NULL                   | issue time + 30 minutes                                 |
| `used_at`    | text, NULL                       | set when consumed or when superseded by a newer request |
| `created_at` | text, NOT NULL                   | issue time                                              |

### 4.4 Migration and DB plumbing

- Schema files above are the single source; `drizzle-kit generate` produces committed SQL in `backend/src/db/migrations`. A `drizzle.config.ts` in `backend/` points at the schema and `DATABASE_PATH`.
- `db/migrate.ts` applies migrations with Drizzle's `better-sqlite3` migrator at server startup (before `listen`) and on the fresh `:memory:` database in each test. No manual SQL bootstrap.
- `db/client.ts` enables `PRAGMA foreign_keys = ON` (SQLite defaults to off) and `journal_mode = WAL`.
- `data/` is created if missing (the resolved `DATABASE_PATH` parent dir; the default resolves to `<repo>/data/app.db`, see 2.3). `*.db` is already git-ignored.
- Transactions: better-sqlite3 transactions are synchronous. The `TransactionRunner` boundary callback is synchronous and must not `await`; anything slow or async (argon2 hashing, JWT signing, mailer) happens before or after the boundary, never inside it. Repository methods used inside a boundary are therefore synchronous. A thrown error inside the callback rolls the whole boundary back.
- ORM row types are internal to repositories; repositories return plain domain types (`AuthUser` with `passwordHash`/`googleId` for service use), and nothing ORM-shaped reaches Presentation or API consumers (architecture "Do not expose ORM models").
- Raw token strings (refresh and reset) never appear in the database, logs (except the deliberate `ConsoleMailer` reset URL), or error messages.

---

## 5. Repository Layer (intention-revealing, feature-specific, single-table, no business rules)

Every repository method reads or writes exactly one table and encodes no workflow. Where a service needs several writes to succeed or fail together, it calls the `TransactionRunner` port (5.4) and sequences the single-table methods itself.

### 5.1 `UserRepository`

- `createUser({ id, name, email, passwordHash, provider, googleId, now })` returns the created user. A UNIQUE violation on `email` (or `google_id`) is surfaced to the service as a typed persistence signal (`UniqueConstraintViolation` with the column) rather than a raw driver error, so the service can map it to `EmailAlreadyExistsError` under a race.
- `findUserByEmail(email)` (caller passes normalized lowercase) returns user or `null`.
- `findUserByGoogleId(googleId)` returns user or `null`.
- `findUserById(id)` returns user or `null`.
- `linkGoogleIdentity({ userId, googleId, now })` sets `google_id` and `updated_at` only; leaves `provider` and `password_hash` untouched.
- `updatePasswordHash({ userId, passwordHash, now })` sets `password_hash` and `updated_at` only; leaves `provider` and `google_id` untouched.

### 5.2 `RefreshTokenRepository`

- `createRefreshToken({ id, userId, tokenHash, expiresAt, now })`.
- `findRefreshTokenByHash(tokenHash)` returns the token row (including `userId`) or `null`. Added so the rotation workflow can learn the owning user; it applies no rule about whether the token is acceptable.
- `revokeActiveRefreshToken({ tokenHash, now })`: one conditional UPDATE (`WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > now`, setting `revoked_at`). Returns `true` if and only if an active, unexpired row was revoked. The conditional update is the race guard: two concurrent revocations of the same token cannot both return `true`.
- `revokeRefreshTokenByHash({ tokenHash, now })`: sets `revoked_at` if the token exists and is not already revoked; no-op otherwise (used by logout, must not throw when absent).
- `revokeAllRefreshTokensForUser({ userId, now })`: sets `revoked_at = now` on all of that user's refresh tokens where `revoked_at IS NULL`.

### 5.3 `PasswordResetTokenRepository`

- `createResetToken({ id, userId, tokenHash, expiresAt, now })`.
- `invalidateUnusedResetTokensForUser({ userId, now })`: sets `used_at = now` for every token of the user where `used_at IS NULL`.
- `consumeResetToken({ tokenHash, now })`: one conditional UPDATE (`WHERE token_hash = ? AND used_at IS NULL AND expires_at > now`, setting `used_at = now`). Returns `{ userId }` when a row was consumed, `null` when the token is unknown, expired, or already used (nothing changed). A concurrent second use of the same token cannot succeed because of the conditional update.

Business decisions (is this token acceptable, what expires when, what else must happen when a token is consumed) stay in services; repositories only execute the single-table conditional persistence they are told to.

### 5.4 `TransactionRunner` port (D-22 in the plan)

- `TransactionRunner.runInTransaction(work)`: opens a database transaction, calls `work` synchronously with the repositories bound to the transaction handle (`{ users, refreshTokens, passwordResetTokens }`), commits when `work` returns, rolls back everything when it throws, and returns what `work` returned. `work` must be synchronous (its type does not allow a promise), because better-sqlite3 transactions are synchronous; see 4.4.
- The Drizzle implementation lives in `auth/repositories/drizzle-transaction-runner.ts`. It executes no queries of its own; it only opens the transaction and builds the transaction-bound repository instances. Tests can substitute a runner that runs against the same real in-memory database.
- Services define the boundary (what runs together); the runner and repositories only execute it. Workflows that use a boundary: rotation (6.2), password reset (6.4), reset-token replacement (6.4).

---

## 6. Service Layer (business rules)

Services take plain arguments (no `req`/`res`), throw typed domain errors, and receive collaborators by constructor injection (`UserRepository`, `RefreshTokenRepository`, `PasswordResetTokenRepository`, `TransactionRunner`, `PasswordHasher`, `AccessTokenSigner`, `GoogleTokenVerifier`, `Mailer`, `Clock`, `IdGenerator`/`TokenGenerator` as needed, and config values such as `frontendOrigin`). Services own every rule and every multi-step sequence; the repositories they call are single-table (5), and any group of writes that must succeed or fail together goes through `TransactionRunner` (5.4).

### 6.1 Domain errors (`auth-errors.ts`, extend `DomainError { code, message }`)

| Error class               | `code`                 | Presentation maps to |
| :------------------------ | :--------------------- | :------------------- |
| `EmailAlreadyExistsError` | `EMAIL_ALREADY_EXISTS` | 409                  |
| `InvalidCredentialsError` | `INVALID_CREDENTIALS`  | 401                  |
| `InvalidGoogleTokenError` | `INVALID_GOOGLE_TOKEN` | 401                  |
| `UnauthenticatedError`    | `UNAUTHENTICATED`      | 401                  |
| `InvalidResetTokenError`  | `INVALID_RESET_TOKEN`  | 400                  |

`VALIDATION_ERROR` (400, with `fieldErrors`) is produced in Presentation by contract/Zod validation before the service layer (architecture "Validation"), not by services. Unexpected errors map to 500 with a non-leaky message and are logged server-side. Error messages are actionable but never reveal enumeration-sensitive facts (for example `INVALID_CREDENTIALS` uses one fixed message for all three login-failure causes).

### 6.2 `SessionService`

Owns credential issuance; used by `AuthService` (after register/login/Google) and by the refresh/logout routes.

- `issueSession(userId)`: returns `{ accessToken, expiresIn: 900, refreshToken (raw), refreshTokenExpiresAt }`.
  - Access token: JWT HS256, claim `sub = userId`, lifetime 15 minutes (`ACCESS_TOKEN_TTL_SECONDS = 900`), signed via `AccessTokenSigner` (jose). The `AccessTokenSigner` adapter receives the `Clock` and uses it for both issuing and verifying: `iat` and `exp` are computed from `clock.now()`, and verification checks expiry against `clock.now()` (for example jose's `currentDate` verify option), so tests control expiry through the clock and never through real time.
  - Refresh token: 32 random bytes (`randomBytes(32)`), base64url; only SHA-256 hex stored; `expiresAt = now + 7 days` (`REFRESH_TOKEN_TTL_MS`).
- `rotateSession(rawRefreshToken | undefined)`: if absent, throw `UnauthenticatedError`. Hash the token (SHA-256, synchronous) and generate the replacement token and id before the boundary. Then, inside one `TransactionRunner` boundary (service-owned sequence, no `await` inside):
  1. `findRefreshTokenByHash`; if none, throw `UnauthenticatedError`.
  2. `revokeActiveRefreshToken`; if it returns `false` (revoked, expired, or lost a race to a concurrent rotation), throw `UnauthenticatedError`.
  3. `findUserById` for the token's user; if the user no longer exists, throw `UnauthenticatedError` (the boundary rolls back).
  4. `createRefreshToken` with the replacement. Revoking the presented token and creating the replacement commit together or not at all.

  After the boundary commits, sign the access token (async) and return the new session (`user`, `accessToken`, `expiresIn`, new raw refresh token) so the router can set the rotated cookie. Two concurrent rotations of the same token: exactly one revoke returns `true`, so exactly one succeeds and the other gets `UnauthenticatedError`. (If signing fails after commit, the response is a 500 and the client has lost that session; accepted, the user signs in again.)

- `revokeSession(rawRefreshToken | undefined)`: if absent, return without error; otherwise `revokeRefreshTokenByHash`. Always succeeds (logout returns 200 even without a valid cookie).
- `verifyAccessToken(token)`: verifies signature (HS256, `JWT_SECRET`) and expiry via `AccessTokenSigner`; returns `userId` (the `sub`), or throws `UnauthenticatedError` for missing/malformed/invalid/expired tokens. Used by `requireAuth` (which is Presentation and calls this service; it does not touch jose or repositories directly).
- Constants (`ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_MS`, `RESET_TOKEN_TTL_MS`) are named constants, no magic numbers.

### 6.3 `AuthService`

`register`, `login` and `loginWithGoogle` are composed methods: each ends by calling `SessionService.issueSession` internally and returns the complete session result (`user`, `accessToken`, `expiresIn`, raw refresh token), so every router handler calls exactly one service method and Presentation performs no two-step workflow (D-18 in the plan). The user-creation-then-session gap is not exposed to Presentation; if session issuance fails after a new account was created, the response is a 500 and the account stays usable through login (accepted, not wrapped in one boundary because signing is async).

- `register({ name, email, password })` (Zod has already validated the shape including `confirmPassword` match; service receives normalized values):
  1. Look up `findUserByEmail(email)`; if any account exists (including Google-created) throw `EmailAlreadyExistsError`.
  2. Hash password with argon2id via `PasswordHasher`.
  3. `createUser` with `provider = "email"`, `googleId = null`. If a unique-constraint violation on `email` occurs (race), throw `EmailAlreadyExistsError`.
  4. Issue the session via `SessionService.issueSession` and return the complete session result (the `{ id, name, email }` projection is a Presentation/contract concern; the result has no `passwordHash` exposure path).
  5. Does not create a profile record (profile feature owns that).
- `login({ email, password })`:
  1. `findUserByEmail(email)`.
  2. If user is absent or `passwordHash` is null: still perform one dummy argon2 verify against a fixed precomputed hash to equalize timing (anti-enumeration), then throw `InvalidCredentialsError`.
  3. Verify password; on mismatch throw `InvalidCredentialsError`. Same error/message for all three causes.
  4. Issue the session as in register and return the complete session result.
- `loginWithGoogle({ idToken })`:
  1. Verify with `GoogleTokenVerifier` (signature, expiry, audience = `GOOGLE_CLIENT_ID`). Any verification failure, or `email_verified !== true`, throws `InvalidGoogleTokenError`. A verified payload that lacks `sub` or `email` is also a verification failure: the verifier adapter reports it as `InvalidGoogleTokenError` and never hands the service incomplete claims. If `GOOGLE_CLIENT_ID` is not configured, throw `InvalidGoogleTokenError`.
  2. Normalize token email to lowercase.
  3. Resolution order (exactly as FDS):
     1. `findUserByGoogleId(sub)` found -> sign that user in.
     2. Else `findUserByEmail(email)` found -> if that account's `googleId` is set and differs from `sub`, throw `InvalidGoogleTokenError` and change nothing (never overwrite); otherwise `linkGoogleIdentity` (keeps `provider` and `passwordHash`) and sign in.
     3. Else create account: `provider = "google"`, `passwordHash = null`, `googleId = sub`, `name` resolved by rule below. On unique-violation race, re-run resolution once (the account was created concurrently) rather than failing.
  4. New-account name resolution: token `name` claim trimmed; if absent or shorter than 2 characters, use the local part of the email (text before `@`); if still shorter than 2 characters, use `"User"`. Implemented as a small pure function `resolveGoogleDisplayName` (unit-tested in isolation).
  5. Issue the session and return the complete session result.
- `getCurrentUser(userId)`: `findUserById`; if not found throw `UnauthenticatedError`. Returns the user.

### 6.4 `PasswordResetService`

- `requestPasswordReset({ email })`:
  1. `findUserByEmail(email)`. If none: return normally (route replies with the same generic response). Nothing is created or logged that differs observably.
  2. If found (including Google-only accounts): generate raw token (32 random bytes, base64url), store SHA-256 hash with `expiresAt = now + 30 minutes`. Inside one `TransactionRunner` boundary, call `invalidateUnusedResetTokensForUser` (marks every earlier unused token for that user used) and then `createResetToken`, so at most one valid link exists even under concurrent requests.
  3. Build `<frontendOrigin>/reset-password?token=<rawToken>` (token URL-encoded) and hand it to the `Mailer` port: `Mailer.sendPasswordResetLink({ toEmail, resetUrl })`. Only `ConsoleMailer` (logs the URL to the server console) is implemented. A production mailer is out of scope.
  4. Mailer failures must not change the response (no enumeration signal); log the error server-side. Response timing for existing vs unknown email should not differ materially (mailer call for `ConsoleMailer` is synchronous logging; no extra mitigation planned beyond not awaiting slow work; flagged in 10).
- `resetPassword({ token, password })` (password strength and confirm-match already validated in Presentation/contract):
  1. Hash the new password with argon2id and compute `sha256(token)` before entering the boundary (argon2 is async and the boundary is synchronous).
  2. Inside one `TransactionRunner` boundary, in this order: `consumeResetToken({ tokenHash, now })`; if it returns `null` throw `InvalidResetTokenError` (nothing changed); otherwise `updatePasswordHash({ userId, passwordHash, now })`, then `revokeAllRefreshTokensForUser({ userId, now })`.
  3. Effects (atomic because the service wraps them in one boundary): password hash set or replaced (a Google-only account gains its first password; `provider` unchanged), token marked used, all the user's refresh tokens revoked. If any step throws, none of them persist. The user is not signed in and no session is issued.

### 6.5 Business rules summary (traceability)

| Rule (FDS)                                                           | Where enforced                                                                                          |
| :------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------ |
| Email unique across all accounts, case-insensitive                   | Lowercase normalization + `email` UNIQUE + service check                                                |
| Login failure indistinguishable across 3 causes                      | `AuthService.login`, single error, dummy hash verify                                                    |
| Google resolution order and never overwrite a different `googleId`   | `AuthService.loginWithGoogle`                                                                           |
| Unverified Google email rejected                                     | `AuthService.loginWithGoogle`                                                                           |
| Refresh token rotated on every use; revoked/expired/unknown rejected | `SessionService.rotateSession` (service-owned boundary) + `revokeActiveRefreshToken` conditional UPDATE |
| Reset token single use, 30-minute expiry, one valid per user         | `PasswordResetService` (boundary) + `consumeResetToken` conditional UPDATE                              |
| Reset revokes all refresh tokens; does not sign user in              | `PasswordResetService.resetPassword` (one boundary)                                                     |
| Logout always succeeds                                               | `SessionService.revokeSession` never throws on absent/invalid                                           |

---

## 7. Presentation Layer

Thin. No business logic, no repository or Drizzle access.

### 7.1 App factory and wiring (`app.ts`, `index.ts`)

- `createApp(deps)` builds and returns the Express app without listening; `index.ts` loads env/config, opens the database, runs migrations, constructs adapters, services, and calls `listen`. This enables tests to start the app on an ephemeral port (`listen(0)`) with an in-memory database, fake `Mailer`, and fake `GoogleTokenVerifier`.
- Middleware order: CORS -> `express.json()` -> JSON body-shape guard (7.6) -> `cookie-parser` -> ts-rest router -> (existing `GET /health` retained) -> final error handler.
- Composition root is the only place that instantiates concrete adapters; services never `new` an adapter.

### 7.2 CORS (`http/cors.ts`, replaces the inline middleware)

- `Access-Control-Allow-Origin: FRONTEND_ORIGIN` (exact origin, never `*` because credentials are used), `Access-Control-Allow-Credentials: true`, `Access-Control-Allow-Headers: Content-Type, Authorization`, `Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS` (the existing list is kept, not narrowed, because later features' endpoints need PATCH and DELETE), `Vary: Origin`; `OPTIONS` preflight returns 204. No new library (handwritten, as today).

### 7.3 ts-rest router (`auth-router.ts`)

- Implements the 8 routes with `@ts-rest/express` against the contract from `packages/contracts` (contract authoring is the Synthesizer's/Contracts step). Handlers: read `body`/cookie -> call one service method -> shape response -> set/clear cookie. Handlers read `req.cookies.refresh_token` and set cookies via `res` here only.
- Request validation failures are converted by a `requestValidationErrorHandler` (`http/request-validation-handler.ts`) into `400 { code: "VALIDATION_ERROR", message, fieldErrors }` where `fieldErrors` holds the first failing rule's message per field, verbatim from the shared schemas (FDS section 5). This replaces ts-rest's default validation error body so the shared error shape holds.
- `error-mapper.ts` maps `DomainError.code` to status per 6.1 and emits `{ code, message }`; unknown errors become `500` with `{ code: "INTERNAL_ERROR", message: <generic> }` (code name is an assumption for the Synthesizer; FDS lists no 500 code).
- Refresh failure clears the cookie by a handler-local mechanism: only the `refreshSession` handler wraps its single service call in a local `try/catch` for `UnauthenticatedError`, and in that catch returns the shared `401 UNAUTHENTICATED` body together with the clearing `Set-Cookie` (via `refresh-cookie.ts`). Every other error from that call, and every error from every other handler, still flows to the global `error-mapper`. This keeps the mapper cookie-agnostic.

### 7.4 Refresh cookie (`refresh-cookie.ts`)

- Name `refresh_token`; attributes `HttpOnly`, `SameSite=Lax`, `Path=/api/v1/auth`, `Max-Age=604800` (7 days), `Secure` when `NODE_ENV=production`.
- Clearing uses identical `Path` (and other attributes) with an expiry in the past / `Max-Age=0`, otherwise browsers will not remove it.
- The raw refresh token is only ever in the `Set-Cookie` header; never in a body or log.

### 7.5 `requireAuth` middleware (`require-auth.ts`)

- Reads `Authorization: Bearer <token>`; missing header, wrong scheme, or empty token -> `401 UNAUTHENTICATED`. Otherwise calls `SessionService.verifyAccessToken`, sets the authenticated `userId` on the request (typed via Express `Request` module augmentation, e.g. `req.userId`), and calls `next()`. Any verification failure (bad signature, expired, malformed) -> `401 UNAUTHENTICATED` in the shared error shape.
- Handlers of other features pass `req.userId` to services as a plain argument. `requireAuth` is exported so later features can mount it per route/router; auth applies it to `GET /auth/me` only among its own routes.
- Since `requireAuth` needs the shared error shape, it uses the same `error-mapper`.

### 7.6 JSON body-shape guard (`http/json-body-guard.ts`)

- Two cases are distinguished. (i) A missing or empty body on an operation that requires one is treated as an empty object, so every required field reports its own "is required" message (unchanged). (ii) A body that is present but valid JSON of a non-object type (array, string, number, boolean, `null`) yields `400 VALIDATION_ERROR` with an empty `fieldErrors` map, exactly like unparseable JSON.
- `express.json()` in strict mode already rejects string/number/boolean/`null` bodies as a parse error, and the shared error handler turns parse errors into that same `400 VALIDATION_ERROR` (empty `fieldErrors`). It accepts arrays, so a small guard runs right after `express.json()` on the body-carrying auth paths (signup, login, google, forgot-password, reset-password): if a body was supplied and is not a plain object, respond `400 VALIDATION_ERROR` with empty `fieldErrors`. The guard is written to be independent of the parser's strictness setting.
- This refines the contract's "Absent required body" and malformed-JSON rows; the Synthesizer should align contract wording (empty/missing body: every field "is required"; present non-object JSON: `VALIDATION_ERROR` with empty `fieldErrors`).

---

## 8. Proposed Routes (plain field lists, not a formal contract)

All prefixed `/api/v1/auth` (matches the cookie `Path`). Validation messages are the FDS section 5 table, first failing rule per field.

| #   | Operation (FDS name)   | Method + path           | Auth                                | Reads (input)                                          | Writes (persistence / side effects)                                                                                                        | Success                                                                                                                                                          | Failure conditions                                                                                                                             |
| --- | :--------------------- | :---------------------- | :---------------------------------- | :----------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `register`             | `POST /signup`          | Public                              | `name`, `email`, `password`, `confirmPassword`         | inserts `users` row (`provider=email`, hashed password); inserts `refresh_tokens` row; sets `refresh_token` cookie                         | `201`: `user {id,name,email}`, `accessToken`, `expiresIn` (900)                                                                                                  | `400 VALIDATION_ERROR` (fieldErrors); `409 EMAIL_ALREADY_EXISTS` (any existing account with that email)                                        |
| 2   | `login`                | `POST /login`           | Public                              | `email`, `password` (non-empty only; no strength rule) | inserts `refresh_tokens` row; sets cookie                                                                                                  | `200`: `user`, `accessToken`, `expiresIn` + cookie                                                                                                               | `400 VALIDATION_ERROR` (empty/malformed); `401 INVALID_CREDENTIALS` (unknown email, wrong password, or no-password account, indistinguishable) |
| 3   | `googleOAuthLogin`     | `POST /google`          | Public                              | `token` (Google ID token)                              | may insert `users` (new Google account) or set `users.google_id` (link); inserts `refresh_tokens` row; sets cookie                         | `200`: `user`, `accessToken`, `expiresIn` + cookie                                                                                                               | `400 VALIDATION_ERROR` (missing/empty `token`); `401 INVALID_GOOGLE_TOKEN` (verification failure, unverified email, or conflicting `googleId`) |
| 4   | `refreshSession`       | `POST /refresh`         | Refresh cookie                      | cookie `refresh_token` (no body)                       | in one transaction revokes presented token and inserts replacement; sets rotated cookie                                                    | `200`: `user`, `accessToken`, `expiresIn` + rotated cookie                                                                                                       | `401 UNAUTHENTICATED` (cookie absent, unknown, revoked, or expired) and the cookie is cleared                                                  |
| 5   | `getCurrentUser`       | `GET /me`               | Bearer (`requireAuth`)              | `Authorization` header (`userId` from `sub`)           | none                                                                                                                                       | `200`: `user`                                                                                                                                                    | `401 UNAUTHENTICATED` (missing/invalid/expired token, or user no longer exists)                                                                |
| 6   | `logout`               | `POST /logout`          | Refresh cookie (optional in effect) | cookie `refresh_token` if present                      | revokes that refresh token if it exists and is active; clears cookie                                                                       | `200`: `success: true` + cleared cookie (always, even with no/invalid cookie)                                                                                    | none from credentials; `5xx` only on unexpected failure                                                                                        |
| 7   | `requestPasswordReset` | `POST /forgot-password` | Public                              | `email`                                                | if account exists: marks earlier unused reset tokens used, inserts new `password_reset_tokens` row, calls `Mailer` with reset URL          | `200`: `success: true`, `message` = "If an account exists for that email, a reset link has been sent." (identical for registered, unregistered, and Google-only) | `400 VALIDATION_ERROR` (empty/malformed email)                                                                                                 |
| 8   | `resetPassword`        | `POST /reset-password`  | Public                              | `token`, `password`, `confirmPassword`                 | in one service-defined transaction: marks token used, sets `users.password_hash`, revokes all the user's refresh tokens; no session issued | `200`: `success: true`                                                                                                                                           | `400 VALIDATION_ERROR` (password rules / mismatch / missing token); `400 INVALID_RESET_TOKEN` (unknown, expired, or used)                      |

Body handling common to the five body-carrying operations: a missing/empty body is an empty object (every required field reports "is required"); a present body that is valid JSON but not an object, or is unparseable, is `400 VALIDATION_ERROR` with empty `fieldErrors` (7.6).

Common: all failures use `{ code, message }` plus `fieldErrors` for validation. Every other feature's endpoints will use `requireAuth` and declare `401` with the same shape (documented here for the Synthesizer; not implemented by auth beyond exporting the middleware).

---

## 9. Validation Rules (server-authoritative, Zod, first failing rule per field)

Schemas and messages live in `packages/contracts` (single source, shared verbatim with the frontend). The backend consumes them; it does not redefine them. Rules to be represented:

- `name`: required (`Name is required.`), min 2 characters (`Name must be at least 2 characters.`). Google-created names are produced by the resolution rule (6.3) and are not passed through this schema.
- `email`: required (`Email is required.`), valid `name@domain.tld` (`Enter a valid email address.`), normalized to lowercase (and trimmed) before use; all lookups and inserts use the normalized value.
- `password` (signup, reset): required, >= 8 characters, at least one digit, at least one special character where special = any char that is not `A-Z`, `a-z`, `0-9` (space and underscore count), with the four FDS messages; order of checks empty -> length -> digit -> special.
- `password` (login): non-empty only (`Password is required.`); strength rules not applied.
- `confirmPassword`: required (`Please confirm your password.`), exactly equals `password` (`Passwords do not match.`); the mismatch error is reported under `confirmPassword`.
- `token` (google, reset): non-empty string; a missing/empty reset `token` returns `400 VALIDATION_ERROR` with a `fieldErrors.token` entry (message text is a contracts decision; the FDS defines none, see 12).
- Duplicate registration: `409 EMAIL_ALREADY_EXISTS` (service-level, not Zod).

---

## 10. Security and Robustness Notes

- Passwords: argon2id via `argon2` default parameters (or a documented parameter constant); plaintext never logged.
- Refresh and reset tokens: 256-bit CSPRNG, stored as SHA-256 only, compared by hash lookup (constant-time compare not required for a hash-indexed lookup of a high-entropy token).
- Rotation and reset are made atomic by service-defined transactions (via the `TransactionRunner` port) around single-table conditional UPDATEs, so replay/concurrent use cannot double-succeed.
- Anti-enumeration: login uses one error and equalizes timing with a dummy hash verify; forgot-password returns an identical response and does not vary on mailer outcome. Residual timing difference on forgot-password (existing account performs a DB write and mailer call) is accepted for this scope.
- CORS never uses `*` with credentials.
- No rate limiting or account lockout is specified in the FDS and none is planned (no new library approved for it).
- Expired/used/revoked token rows are not purged; no cleanup job is in scope.
- Access token contains only `sub` (plus standard `iat`/`exp`); no PII.

---

## 11. Backend Testing Requirements

Tooling: Vitest (already configured, `passWithNoTests`). Service tests that involve a transaction boundary (rotation, reset, reset-token replacement) use the real `TransactionRunner` implementation over a real in-memory better-sqlite3 database with migrations, not a fake runner, so rollback behavior is genuinely exercised. No `supertest`: API tests start the Express app returned by `createApp` on an ephemeral port (`listen(0)`) and call it with Node's global `fetch`. Each test file builds its own fresh in-memory SQLite database (`:memory:`) with migrations applied, a fake `Mailer` capturing reset URLs, a fake `GoogleTokenVerifier` returning canned claims, and a controllable `Clock`; no shared mutable state between tests. Coverage target for the feature: 95 percent (per FDS `coverage_target`), measured with `@vitest/coverage-v8`.

### 11.1 Unit tests: pure logic and services (fakes for ports; in-memory fake or real in-memory repositories)

`resolveGoogleDisplayName`: trimmed `name` claim used; absent name falls back to email local part; name of 1 character falls back; local part under 2 characters falls back to `"User"`; whitespace-only name.

`AuthService.register`: creates `provider=email` user with hashed (not plaintext) password, lowercase email; duplicate email (same case and different case) throws `EmailAlreadyExistsError`; duplicate against a Google-created account throws `EmailAlreadyExistsError`; unique-violation race maps to `EmailAlreadyExistsError`; no profile is created.

`AuthService.login`: success; unknown email, wrong password, and Google-only account all throw the identical `InvalidCredentialsError` (same code and message); dummy hash verify still invoked for unknown/no-password cases (spy on `PasswordHasher`); email matched case-insensitively.

`AuthService.loginWithGoogle`: existing `googleId` signs in that user; existing email account is linked (`googleId` set, `provider` and `passwordHash` unchanged, `updatedAt` bumped); unknown email creates `provider=google`, `passwordHash=null` account with resolved name; conflicting different `googleId` on the email account throws `InvalidGoogleTokenError` and leaves the account unchanged; unverified email throws; verifier rejection throws; verified payload missing `sub` or missing `email` throws `InvalidGoogleTokenError` (tested at the adapter and through the service); unset `GOOGLE_CLIENT_ID` throws; token email case-normalized; concurrent-create race re-resolves.

`AuthService.register` / `login` / `loginWithGoogle` (composed): each returns the complete session result (user, access token, `expiresIn` 900, raw refresh token) and persists exactly one refresh-token row (hash only).

`AuthService.getCurrentUser`: returns user; unknown id throws `UnauthenticatedError`.

`SessionService`: `issueSession` returns 900 `expiresIn`, JWT `sub` = userId, refresh token 256-bit base64url with only its hash stored and `expiresAt` = now + 7 days; `rotateSession` revokes the old and issues a new token; reusing the rotated (revoked) token throws `UnauthenticatedError`; expired token (advance `Clock` past 7 days) throws; unknown token throws; absent token throws; user deleted after issuance throws and leaves the presented token unrevoked (rolled back); `revokeSession` revokes an active token, is a no-op for absent/unknown/already-revoked tokens (never throws); `verifyAccessToken` accepts valid, rejects bad signature, expired (advance clock 15 min + 1 s, controlled purely through the `Clock` handed to the signer), malformed, and wrong-algorithm tokens.

Atomicity and race (service level, real in-memory DB and real `TransactionRunner`):

- Rotation atomicity: force `createRefreshToken` to fail for the replacement (for example through a wrapper that throws on that call); the presented token is still active afterwards and no replacement row exists.
- Rotation race: two `rotateSession` calls started together with the same raw token (`Promise.all`); exactly one returns a session, the other throws `UnauthenticatedError`, and exactly one replacement row exists.
- Reset atomicity: force `revokeAllRefreshTokensForUser` (the last step) to throw; the token is still unused, the old password hash is unchanged, and the user's refresh tokens are still active.
- Reset-token replacement atomicity: force `createResetToken` to throw; the earlier unused token is still unused (invalidation rolled back).
- Reset race: two `resetPassword` calls with the same token started together; exactly one succeeds, the other throws `InvalidResetTokenError`.
- `TransactionRunner` itself: returns the callback's value; commits on return; rolls back every write when the callback throws; the callback cannot be asynchronous (type-level, plus a test that a returned promise is rejected or flagged, per Build's chosen guard).

`PasswordResetService.requestPasswordReset`: registered email creates a token (30-minute expiry, only hash stored) and calls `Mailer` once with a URL of the form `<FRONTEND_ORIGIN>/reset-password?token=<raw>` whose raw token hashes to the stored hash; Google-only account also gets a token; unknown email creates nothing and does not call `Mailer`, and returns without error; second request marks the first token used (only the latest is valid); mailer throwing does not surface as an error.

`PasswordResetService.resetPassword`: valid token sets new hash (old password no longer verifies, new does), marks token used, revokes all of the user's refresh tokens (several active tokens all revoked), issues no session; token reuse throws `InvalidResetTokenError`; token at exactly 30 minutes and after throws; unknown token throws; superseded token throws; Google-only account gains a password and `provider` stays `google`; failed attempt changes nothing.

Adapters: `Argon2PasswordHasher` hashes to an argon2id string and verifies correct/incorrect; `ConsoleMailer` logs the reset URL; `GoogleAuthLibraryVerifier` maps library results and errors to the port's claims/failure (with the library's client stubbed; no network), including a payload without `sub` and a payload without `email` mapping to `InvalidGoogleTokenError`; `JoseAccessTokenSigner` computes `iat`/`exp` from the injected `Clock` and rejects a token as expired only when the clock passes `exp`; `resolveDatabasePath` (config): relative path resolves against the nearest ancestor holding `pnpm-workspace.yaml` (run from `backend/` and from the repo root give the same file), absolute path unchanged, `:memory:` passed through, fallback to cwd when no workspace file exists; JSON body guard: array, string, number, boolean and `null` bodies rejected with `VALIDATION_ERROR` and empty `fieldErrors`, plain object and missing/empty body pass through.

### 11.2 Repository tests (real `better-sqlite3` in-memory database with migrations)

- `UserRepository`: create and find by email/id/googleId; UNIQUE violation on `email` and on `google_id` surfaced as the typed violation; `linkGoogleIdentity` changes only `google_id`/`updated_at`; CHECK constraint blocks a row with neither password nor googleId.
- `UserRepository.updatePasswordHash`: changes only `password_hash`/`updated_at`.
- `RefreshTokenRepository`: `findRefreshTokenByHash` returns the row or `null`; `revokeActiveRefreshToken` returns `true` and sets `revoked_at` for an active token, returns `false` (no change) for already-revoked, expired (at exactly `expires_at` and after), and unknown tokens, and two sequential calls with the same token yield exactly one `true`; `revokeRefreshTokenByHash` no-op when absent; `revokeAllRefreshTokensForUser` revokes only that user's active tokens.
- `PasswordResetTokenRepository`: `invalidateUnusedResetTokensForUser` marks only that user's unused tokens; `consumeResetToken` returns `{ userId }` and sets `used_at` for an unused, unexpired token, returns `null` without side effects for used/expired/unknown tokens, and a second call with the same token returns `null`.
- Each repository method touches only its own table (asserted by reading the other tables' rows before and after).
- Multi-step atomicity is tested at the service level (11.1), not here, because repositories no longer own workflows.
- Foreign keys enforced (inserting a token for a nonexistent user fails).

### 11.3 API / integration tests (real HTTP via `fetch` against `createApp` on an ephemeral port; assert status, body, and `Set-Cookie`)

Register (`POST /signup`): 201 with `user {id,name,email}`, `accessToken`, `expiresIn=900`; `Set-Cookie: refresh_token` with `HttpOnly`, `SameSite=Lax`, `Path=/api/v1/auth`, `Max-Age=604800`, no `Secure` outside production and `Secure` when `NODE_ENV=production`; body never contains a refresh token or `passwordHash`; email lowercased in response; duplicate email 409 `EMAIL_ALREADY_EXISTS` (also when differing only by case, and when the existing account is Google-created); each validation-table row yields 400 `VALIDATION_ERROR` with the exact `fieldErrors` message (first failing rule per field), including password no digit / no special / too short, mismatched `confirmPassword`, empty and 1-character name, invalid email.

Login: 200 shape and cookie; unknown email, wrong password, and Google-only account each return byte-identical `401 INVALID_CREDENTIALS` bodies; empty password 400; a weak-but-correct existing password still signs in (strength not applied).

Google: valid new-user token returns 200 and creates account; existing email account is linked and can then still sign in with its password; second call with the same token signs in the same user (no duplicate); unverified email 401; verifier failure 401; conflicting `googleId` 401 and account unchanged; missing `token` 400; no cookie set on any 401.

Refresh: after login, `POST /refresh` with cookie returns 200 with a new `accessToken` and a rotated cookie different from the old one; replaying the old cookie returns 401 `UNAUTHENTICATED` and a clearing `Set-Cookie`; missing cookie 401 with a clearing `Set-Cookie`; expired refresh (via controllable clock) 401 with a clearing `Set-Cookie`; two concurrent `POST /refresh` calls with the same cookie: exactly one 200 and one 401; a non-401 failure on refresh (for example a forced 500) does not go through the local cookie-clearing path.

Me: valid Bearer returns 200 `user`; no header, wrong scheme, garbage token, tampered signature, and expired token (clock advanced >15 minutes) each 401 `UNAUTHENTICATED` with `{ code, message }`.

Logout: revokes the token so a subsequent `/refresh` with the old cookie is 401; returns 200 `success: true` with a clearing cookie also when no cookie, an unknown cookie, or an already-revoked cookie is sent.

Forgot password: identical 200 body and message for registered, unregistered, and Google-only emails; invalid email 400; registered email results in exactly one captured reset URL with the expected origin/path; second request supersedes the first link (first link then fails at reset with `INVALID_RESET_TOKEN`).

Reset password: valid token 200 `success: true`; old password no longer logs in and new one does; the user's pre-existing refresh cookie then fails `/refresh` with 401 (all sessions revoked); same token a second time 400 `INVALID_RESET_TOKEN`; token used after 30 minutes 400 `INVALID_RESET_TOKEN`; unknown token 400 `INVALID_RESET_TOKEN`; weak password or mismatched confirm 400 `VALIDATION_ERROR` with FDS messages and the token stays usable; no cookie or session issued on success; Google-only account can set a first password and then log in with email/password.

Middleware and cross-cutting: `requireAuth` applied to a probe route in the test app returns 401 `UNAUTHENTICATED` without a valid Bearer token and exposes `userId` to the handler with a valid one; CORS preflight `OPTIONS` returns 204 with `Access-Control-Allow-Origin` = `FRONTEND_ORIGIN`, `Access-Control-Allow-Credentials: true`, `Authorization` in allowed headers and `Access-Control-Allow-Methods` still listing `GET, POST, PATCH, DELETE, OPTIONS`; unexpected exception yields 500 without stack/internal details; existing `GET /health` still returns 200.

Request bodies: malformed (unparseable) JSON yields 400 `VALIDATION_ERROR` with empty `fieldErrors`; valid JSON of a non-object type (array, string, number, boolean, `null`) sent to each body-carrying operation yields the same 400 with empty `fieldErrors`; a missing body and an empty body (no content, and `{}`) yield 400 `VALIDATION_ERROR` where every required field reports its own "is required" message.

Log and body safety: while running the full flows (signup, login, Google, refresh, logout, forgot/reset password, and the failure paths), capture everything written to the server logs (console methods) and assert that no raw refresh token, raw reset token, or plaintext password appears in it. The single allowed exception is the deliberate `ConsoleMailer` reset-URL line, tested separately with the real `ConsoleMailer`: it contains the raw reset token once and nothing else does. Also assert that no error response body (validation, `INVALID_RESET_TOKEN`, `INVALID_CREDENTIALS`, 401, 500) echoes a submitted password or token, and that success bodies never contain the refresh token or a password hash.

Config: missing `JWT_SECRET` (and too-short secret, if the minimum is approved) fails startup with a clear error; missing `GOOGLE_CLIENT_ID` does not block startup.

### 11.4 Test hygiene

- Every test sets up and tears down its own app/database (server closed in `afterEach`).
- Time-dependent expiry tests use the injected `Clock`, never real sleeps.
- No test asserts on private implementation details; tests assert observable outcomes (responses, cookies, persisted rows through repository read methods).

---

## 12. Backend Needs From Contracts (inputs for the Synthesizer, not a contract)

- Shared Zod schemas with the FDS messages for `name`, `email`, `password`, `confirmPassword` (signup and reset variants; login variant with non-empty password), reset `token`, and Google `token`; usable by both the ts-rest server (request validation) and the frontend.
- Response schemas: `user {id,name,email}`, session body `{ user, accessToken, expiresIn }`, `{ success: true }`, `{ success: true, message }`, and the shared error shape `{ code, message, fieldErrors? }` with the error codes from FDS section 6.
- Cookie and Authorization behavior are transport details outside the ts-rest body schema; the contract needs to allow the backend to set/clear the cookie in handlers.
- Contract must be written so the backend can install a custom request-validation error handler (see 7.3).
- Contract wording to align with 7.6: a missing/empty body is an empty object (every required field "is required"); a present body that is valid JSON but not an object, or is unparseable, is `400 VALIDATION_ERROR` with empty `fieldErrors`. CORS wording keeps saying the allowed methods "include" what auth needs (the backend keeps `GET, POST, PATCH, DELETE, OPTIONS`).
- Because the contracts package is committed first (13, task 0), it must be complete enough for the frontend to consume without further edits: all eight routes, shared schemas with the FDS messages, response and error schemas.

## 13. Backend Build Task Outline (for the Synthesizer to sequence)

0. Contracts package (`packages/contracts`) authored from the Synthesizer's contract. This is the first Backend Build task (BE-01) and is committed before the Frontend session starts, because the frontend builds against the committed `@expense-tracker/contracts` package. After that commit the Backend session continues with the tasks below in parallel with the Frontend session. This is a deliberate, documented deviation from fully parallel Phase 5 (D-23 in the plan). Traces to FDS §6 and `rules/architecture.md` (API Contracts).
1. Config module (including repo-root `DATABASE_PATH` resolution), `createApp` refactor, CORS update (methods kept), JSON body-shape guard, DB client/migrations plumbing, `DomainError`, `Clock`. Traces to FDS §6 and the layering decision (plan D-17).
2. Drizzle schema + first migration; single-table repositories, `TransactionRunner` port and Drizzle implementation, + repository and runner tests.
3. Ports + adapters (`PasswordHasher`, `AccessTokenSigner` with injected `Clock`, `GoogleTokenVerifier`, `Mailer`/`ConsoleMailer`) + adapter tests.
4. `SessionService`, `AuthService` (composed methods), `PasswordResetService` (service-owned workflows) + unit tests including the atomicity and race tests in 11.1.
5. `requireAuth`, refresh-cookie helper, error mapper, request-validation handler, ts-rest router (contract already committed by task 0; refresh handler with local cookie-clearing catch) + API tests including log-safety.
6. Wire composition root in `index.ts`; add dependencies; root-level items from 2.2 (owner TBD by Synthesizer). Traces to FDS §3, §6 and the layering decision (plan D-17).

Path boundaries: `backend/` and `packages/contracts/` only, plus the two root files flagged in 2.2. The Frontend session never edits `packages/contracts`.

---

## 14. Open Points Flagged for the Synthesizer / Developer (none block the fragment; each is a small choice the FDS leaves open)

These are not ambiguities in the FDS's requirements; they are implementation choices the FDS is silent on. Listed so the developer can confirm at the approval gate rather than have them silently baked in:

1. `JWT_SECRET` minimum length (proposed 32 characters, fail-fast at startup).
2. `GOOGLE_CLIENT_ID` unset: server starts, Google login returns `401 INVALID_GOOGLE_TOKEN`.
3. Access token for a user that no longer exists: `GET /auth/me` and refresh return `401 UNAUTHENTICATED` (FDS defines only that code for auth failures).
4. `500` response body code name (`INTERNAL_ERROR`) and message; the FDS defines no 500 code.
5. Message text for `fieldErrors.token` when the `token` is missing/empty on `resetPassword` and `googleOAuthLogin` (FDS section 5 has no row for it).
6. Owner of the two root-level file changes (`pnpm-workspace.yaml` `allowBuilds`, `.env.example`).
7. (Decided) `register`/`login`/`googleOAuthLogin` session issuance is folded into composed `AuthService` methods; each handler calls exactly one service method (6.3).
8. Confirm at the gate: are the `PasswordHasher`, `AccessTokenSigner` and `TransactionRunner` ports wanted, versus `rules/conventions.md` "avoid unnecessary abstractions"? They are kept for network-free, time-controlled, rollback-testable services (`Mailer` is FDS-mandated).
9. If no `pnpm-workspace.yaml` is found when resolving `DATABASE_PATH`, fall back to `process.cwd()` (the FDS is silent; alternative is to fail fast).

Developer-approved decisions applied in this revision (for the Synthesizer's Decision Log): D-22 transaction-runner port and service-owned workflows with single-table repositories; D-23 the contracts package is the first Backend Build task and is committed before the Frontend session starts; D-26 a relative `DATABASE_PATH` is resolved against the repository root (nearest ancestor with `pnpm-workspace.yaml`); D-17/D-18 rewritten accordingly (layering; composed service methods).
