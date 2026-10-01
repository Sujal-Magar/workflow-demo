# Backend Fragment: Authentication and Identity (`auth`)

> **SUPERSEDED.** Stale after revisions 1, 2, 3 and 4. Kept as an audit trail only; do not use as synthesis input. The authoritative sources are `../plan.md` and `../contract.md`.

- **Feature ID:** `auth`
- **FDS version:** 1.0.0 (`features/auth/fds.md`)
- **Fragment scope:** Backend + Backend Testing only (no Frontend, no Integration, no formal API contract)
- **Coverage target:** 95% (FDS frontmatter), `compliance_relevant: true`

---

## 1. Current State & Baseline

- `backend/src/index.ts` is a single file: env loading via `process.loadEnvFile`, a hand-rolled CORS middleware (no credentials, only `Content-Type` allowed), `GET /health`, and `app.listen` at module load.
- No database code, no Drizzle schema, no migrations, no `data/` directory yet. `.env.example` declares `PORT`, `FRONTEND_ORIGIN`, `DATABASE_PATH=./data/app.db`. Playwright starts the backend with `cwd: backend` and `DATABASE_PATH=data/e2e-test.db`, so `DATABASE_PATH` is resolved relative to the backend process working directory.
- `packages/contracts/src/index.ts` is an empty entry point. `@ts-rest/core`, `@ts-rest/express` and `zod` are already installed.
- `backend/tsconfig.json` compiles to CommonJS (hence the FDS constraint `jose@5.x`).

Auth is the first feature, so it also establishes the backend's foundational structure (app factory, DB bootstrap, error handling, request validation mapping) that later features reuse.

---

## 2. Dependencies (all approved in FDS §2)

| Package                | Where           | Notes                                                                                |
| :--------------------- | :-------------- | :----------------------------------------------------------------------------------- |
| `argon2`               | backend deps    | argon2id. Native module: pnpm must be allowed to run its build script (see Open Q-1) |
| `jose` `^5`            | backend deps    | HS256 sign/verify. Must stay on 5.x (CommonJS output)                                |
| `google-auth-library`  | backend deps    | `OAuth2Client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })`                |
| `cookie-parser`        | backend deps    | Reads `refresh_token` cookie                                                         |
| `@types/cookie-parser` | backend devDeps | Types only                                                                           |

No HTTP test client is added. API tests use global `fetch` against an app bound to an ephemeral port (`listen(0)`).

---

## 3. Proposed Backend Structure

All paths under `backend/src/` (kebab-case filenames per `rules/conventions.md`).

```
backend/src/
├── index.ts                         # Entry: load env, build config, open DB, run migrations, createApp(), listen(PORT)
├── app.ts                           # createApp(deps): express app factory (no listen) — used by index.ts and API tests
├── config/
│   └── env.ts                       # Reads & validates env (Zod): JWT_SECRET, GOOGLE_CLIENT_ID, FRONTEND_ORIGIN, NODE_ENV, DATABASE_PATH, PORT
├── db/
│   ├── client.ts                    # createDatabase(path) → better-sqlite3 + drizzle instance; ":memory:" for tests
│   ├── migrate.ts                   # Applies drizzle migrations (drizzle-orm/better-sqlite3/migrator)
│   ├── schema/
│   │   ├── index.ts                 # Re-exports all tables
│   │   └── auth.ts                  # users, refresh_tokens, password_reset_tokens
│   └── migrations/                  # drizzle-kit generated SQL (committed)
├── drizzle.config.ts (backend root) # drizzle-kit config pointing at src/db/schema
├── shared/
│   ├── errors/
│   │   ├── domain-error.ts          # Base DomainError { code, message, httpStatus-agnostic }
│   │   └── error-handler.ts         # Express error middleware: DomainError → status + { code, message }; unknown → 500
│   ├── http/
│   │   └── validation-error.ts      # ts-rest requestValidationErrorHandler → 400 VALIDATION_ERROR + fieldErrors
│   └── clock.ts                     # Clock port ({ now(): Date }) — injectable for expiry tests
└── features/auth/
    ├── auth-router.ts               # ts-rest createExpressEndpoints for the auth contract (Presentation)
    ├── require-auth.ts              # requireAuth middleware (Presentation) — exported for other features
    ├── refresh-cookie.ts            # set/clear refresh_token cookie helpers (Presentation)
    ├── auth-errors.ts               # Domain error classes (see §7)
    ├── auth-service.ts              # register, login, loginWithGoogle, refreshSession, getCurrentUser, logout
    ├── password-reset-service.ts    # requestPasswordReset, resetPassword
    ├── session-issuer.ts            # issues access JWT + refresh token pair (used by both services) — Service layer
    ├── user-repository.ts           # UserRepository
    ├── refresh-token-repository.ts  # RefreshTokenRepository
    ├── password-reset-token-repository.ts
    ├── ports/
    │   ├── password-hasher.ts       # interface + Argon2PasswordHasher
    │   ├── access-token-signer.ts   # interface + JoseAccessTokenSigner (sign/verify HS256)
    │   ├── google-token-verifier.ts # interface + GoogleAuthLibraryVerifier
    │   ├── mailer.ts                # Mailer interface + ConsoleMailer
    │   └── token-generator.ts       # opaque 256-bit base64url tokens + SHA-256 hashing (node:crypto)
    └── user-mapper.ts               # DB row → public user { id, name, email } (never exposes passwordHash/googleId/provider)
```

Notes:

- `createApp(deps)` receives its collaborators (db, clock, mailer, googleVerifier, config) so API tests can inject an in-memory DB, a fixed clock, a capturing mailer and a fake Google verifier. `index.ts` wires the production implementations.
- The Express `Request` type is augmented (declaration merging in `require-auth.ts` or a `types/express.d.ts`) with `userId?: string`. A small `getAuthenticatedUserId(req)` helper returns a `string` and throws `UnauthenticatedError` if absent, so handlers never deal with `undefined`.
- Ports wrap each third-party library so services stay pure TypeScript and testable, and so `google-auth-library` never has to be reached over the network in tests.

---

## 4. Data Model (Drizzle, SQLite)

Timestamps are stored as ISO-8601 UTC strings in `text` columns (matches FDS "ISO Timestamp"; sortable and comparable lexically). IDs are `crypto.randomUUID()` strings generated in the repository/service, not by SQLite.

### 4.1 `users` (entity `UserAuth`)

| Column          | Drizzle type                      | Constraints                                          |
| :-------------- | :-------------------------------- | :--------------------------------------------------- |
| `id`            | `text`                            | PK                                                   |
| `name`          | `text`                            | NOT NULL                                             |
| `email`         | `text`                            | NOT NULL, UNIQUE (stored lowercase)                  |
| `password_hash` | `text`                            | NULL allowed (Google-created, no password)           |
| `provider`      | `text` enum `["email", "google"]` | NOT NULL; never changes after creation               |
| `google_id`     | `text`                            | NULL allowed, UNIQUE (SQLite permits multiple NULLs) |
| `created_at`    | `text`                            | NOT NULL                                             |
| `updated_at`    | `text`                            | NOT NULL                                             |

- Table-level `CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL)` enforces FDS §3 "always has at least one of the two".
- The UNIQUE constraint on `email` is the last line of defence for concurrent duplicate sign-ups: a unique-constraint violation on insert is translated by the repository into a typed "email taken" result so the service raises `EmailAlreadyExistsError` (409), never a 500.

### 4.2 `refresh_tokens` (entity `RefreshToken`)

| Column       | Type   | Constraints                                     |
| :----------- | :----- | :---------------------------------------------- |
| `id`         | `text` | PK                                              |
| `user_id`    | `text` | NOT NULL, FK → `users.id` ON DELETE CASCADE     |
| `token_hash` | `text` | NOT NULL, UNIQUE (SHA-256 hex of the raw token) |
| `expires_at` | `text` | NOT NULL (issue time + 7 days)                  |
| `revoked_at` | `text` | NULL allowed                                    |
| `created_at` | `text` | NOT NULL                                        |

Index on `user_id` (revoke-all on password reset).

### 4.3 `password_reset_tokens` (entity `PasswordResetToken`)

| Column       | Type   | Constraints                                     |
| :----------- | :----- | :---------------------------------------------- |
| `id`         | `text` | PK                                              |
| `user_id`    | `text` | NOT NULL, FK → `users.id` ON DELETE CASCADE     |
| `token_hash` | `text` | NOT NULL, UNIQUE (SHA-256 hex of the raw token) |
| `expires_at` | `text` | NOT NULL (issue time + 30 minutes)              |
| `used_at`    | `text` | NULL allowed                                    |
| `created_at` | `text` | NOT NULL                                        |

Index on `user_id` (invalidate earlier unused tokens).

### 4.4 Database bootstrap

- `DATABASE_PATH` (default `data/app.db`) resolved against the process working directory; the parent directory is created if missing. SQLite `PRAGMA foreign_keys = ON` and `journal_mode = WAL` set on open.
- Migrations generated by `drizzle-kit generate` into `backend/src/db/migrations` and applied at startup by `migrate()`; API/repository tests apply the same migrations to a `:memory:` database per test (or per file with table truncation between tests).
- Add backend scripts: `db:generate` (`drizzle-kit generate`) and, optionally, `db:migrate`.

---

## 5. Repository Layer (persistence only, no business rules)

### `UserRepository`

| Method                                                                                                    | Purpose                                                                             |
| :-------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------- |
| `findUserById(id)` → `UserRecord \| null`                                                                 | `/me`, refresh (to return `user`)                                                   |
| `findUserByEmail(email)` → `UserRecord \| null`                                                           | login, register pre-check, Google step 2, forgot-password (email already lowercase) |
| `findUserByGoogleId(googleId)` → `UserRecord \| null`                                                     | Google step 1                                                                       |
| `createUser(input)` → `CreateUserResult` (`{ ok: true, user }` or `{ ok: false, reason: "EMAIL_TAKEN" }`) | register + Google step 3; maps SQLite UNIQUE violation on `email`                   |
| `linkGoogleId(userId, googleId, now)` → `UserRecord`                                                      | Google step 2 (sets `google_id`, bumps `updated_at`)                                |
| `updatePasswordHash(userId, passwordHash, now)`                                                           | reset-password                                                                      |

### `RefreshTokenRepository`

| Method                                                      | Purpose                                           |
| :---------------------------------------------------------- | :------------------------------------------------ |
| `createRefreshToken({ userId, tokenHash, expiresAt, now })` | issue on register/login/google/refresh            |
| `findRefreshTokenByHash(tokenHash)` → record \| null        | refresh, logout                                   |
| `revokeRefreshToken(id, now)`                               | rotation, logout (only sets `revoked_at` if NULL) |
| `revokeAllRefreshTokensForUser(userId, now)`                | password reset                                    |

### `PasswordResetTokenRepository`

| Method                                                    | Purpose                                              |
| :-------------------------------------------------------- | :--------------------------------------------------- |
| `invalidateUnusedResetTokensForUser(userId, now)`         | forgot-password: sets `used_at` on all unused tokens |
| `createResetToken({ userId, tokenHash, expiresAt, now })` | forgot-password                                      |
| `findResetTokenByHash(tokenHash)` → record \| null        | reset-password                                       |
| `markResetTokenUsed(id, now)`                             | reset-password                                       |

### Transactions

Services declare transactional intent; repositories execute it via Drizzle `db.transaction(...)` (synchronous callbacks with `better-sqlite3`). Multi-step writes that must be atomic:

1. **Refresh rotation:** revoke presented token + insert new token.
2. **Forgot password:** invalidate earlier unused tokens + insert new token.
3. **Reset password:** update password hash + mark reset token used + revoke all user refresh tokens.

Proposed mechanism: a `runInTransaction(fn)` unit-of-work helper exposed from the repository layer (e.g. on a small `AuthPersistence`/`AuthUnitOfWork` object that hands transaction-bound repository instances to `fn`). Services call it without touching Drizzle directly. Because `better-sqlite3` transactions are synchronous, all argon2 hashing (async) is done **before** entering the transaction.

---

## 6. Service Layer (business rules)

All services are Express-agnostic; they receive plain arguments (`userId`, input DTOs, raw refresh-token string) and return plain results or throw domain errors.

### 6.1 Constants (named, per conventions)

| Constant                     | Value                                                              |
| :--------------------------- | :----------------------------------------------------------------- |
| `ACCESS_TOKEN_TTL_SECONDS`   | `900` (15 min) — also `expiresIn`                                  |
| `REFRESH_TOKEN_TTL_SECONDS`  | `604800` (7 days) — also cookie `Max-Age`                          |
| `PASSWORD_RESET_TTL_MINUTES` | `30`                                                               |
| `REFRESH_TOKEN_BYTES`        | `32` (256-bit), base64url                                          |
| `RESET_TOKEN_BYTES`          | `32` (256-bit), base64url                                          |
| `REFRESH_COOKIE_NAME`        | `refresh_token`                                                    |
| `REFRESH_COOKIE_PATH`        | `/api/v1/auth`                                                     |
| `FORGOT_PASSWORD_MESSAGE`    | `If an account exists for that email, a reset link has been sent.` |
| `GOOGLE_FALLBACK_NAME`       | `User`                                                             |

### 6.2 `SessionIssuer` (shared by auth & reset flows)

`issueSession(userId)`:

1. Sign access JWT (HS256, `sub = userId`, `iat`, `exp = now + 900s`) with `JWT_SECRET`.
2. Generate raw refresh token (32 random bytes, base64url), store only `sha256(raw)` with `expiresAt = now + 7d`.
3. Return `{ accessToken, expiresIn: 900, refreshToken: raw }`. The raw refresh token goes to the Presentation layer only for the cookie; it is never put in a response body.

### 6.3 `AuthService`

**`register({ name, email, password })`** (REQ-AUTH-01)

- Normalize email to lowercase (authoritative, independent of contract transforms).
- If `findUserByEmail` returns an account (email- or Google-created) → `EmailAlreadyExistsError` (409 `EMAIL_ALREADY_EXISTS`).
- Hash password with argon2id; `createUser({ provider: "email", passwordHash, googleId: null })`. If the insert reports `EMAIL_TAKEN` (race) → `EmailAlreadyExistsError`.
- Does **not** create any profile record (profile feature provisions on first access).
- Issue session; return `{ user, accessToken, expiresIn, refreshToken }`.

**`login({ email, password })`** (REQ-AUTH-02)

- Normalize email. Look up user.
- Unknown email, `passwordHash === null` (Google-only), or argon2 verify failure → **the same** `InvalidCredentialsError` (401 `INVALID_CREDENTIALS`), same message.
- Recommended: when the user is unknown or has no password, still run an argon2 verify against a fixed dummy hash so response timing does not distinguish the cases (anti-enumeration, FDS AC "never reveals").
- Issue session; return as above.

**`loginWithGoogle({ idToken })`** (REQ-AUTH-03)

1. `googleVerifier.verify(idToken)` (signature, expiry, `aud === GOOGLE_CLIENT_ID` via `google-auth-library`). Any verification failure, missing `sub`/`email`, or `email_verified !== true` → `InvalidGoogleTokenError` (401 `INVALID_GOOGLE_TOKEN`).
2. Normalize the token email to lowercase.
3. Resolution order:
   1. `findUserByGoogleId(sub)` → found: sign in (email on the account is not changed even if the Google email differs).
   2. Else `findUserByEmail(email)` → found:
      - if `googleId` is `null` → `linkGoogleId(userId, sub)`; keep `provider` and `passwordHash`; sign in.
      - if `googleId` is set to a **different** value → `InvalidGoogleTokenError`; no write occurs.
   3. Else create: `provider = "google"`, `passwordHash = null`, `googleId = sub`, `name = resolveGoogleName(claims)`. If the insert reports `EMAIL_TAKEN` (race with a concurrent register), re-run resolution once from step 2 (link path) rather than returning 500 — see Open Q-6.
4. Issue session; return as above.

`resolveGoogleName(nameClaim, email)` (pure function, unit-tested):

- `nameClaim?.trim()` if length ≥ 2;
- else the email local part (text before `@`) if length ≥ 2;
- else `"User"`.

**`refreshSession(rawRefreshToken | undefined)`** (Session Model, REQ-AUTH-06 Restore/Renew)

- Missing/empty cookie → `UnauthenticatedError`.
- Look up by `sha256(raw)`. Unknown, `revokedAt` set, or `expiresAt <= now` → `UnauthenticatedError` (Presentation clears the cookie on this error).
- User no longer exists → `UnauthenticatedError`.
- In one transaction: revoke the presented token, insert the new one (rotation on every use).
- Return `{ user, accessToken, expiresIn, refreshToken: newRaw }`.
- No reuse-detection / token-family revocation is specified, so none is added.

**`getCurrentUser(userId)`** (REQ-AUTH-06 Current user)

- `findUserById`; missing → `UnauthenticatedError` (token valid but subject gone). Returns public `user`.

**`logout(rawRefreshToken | undefined)`** (REQ-AUTH-06 End)

- If a cookie is present and matches a stored, not-yet-revoked token → revoke it.
- Missing, unknown, expired or already-revoked cookie → no error. Always succeeds.

### 6.4 `PasswordResetService`

**`requestPasswordReset({ email })`** (REQ-AUTH-05 Step 1)

- Normalize email; look up user.
- Not found → do nothing, return the generic message.
- Found (including Google-only accounts):
  1. Transaction: `invalidateUnusedResetTokensForUser` (mark used) + `createResetToken` (hash stored, `expiresAt = now + 30 min`).
  2. Build URL `${FRONTEND_ORIGIN}/reset-password?token=${encodeURIComponent(raw)}` (base64url is already URL-safe) and call `mailer.sendPasswordResetLink({ to: email, resetUrl })`.
- Always returns `{ success: true, message: FORGOT_PASSWORD_MESSAGE }` — identical for registered/unregistered/Google-only.
- `ConsoleMailer` logs the URL to the server console (development delivery). No production mailer.

**`resetPassword({ token, password })`** (REQ-AUTH-05 Step 2)

- Look up by `sha256(token)`. Unknown, `usedAt` set, or `expiresAt <= now` → `InvalidResetTokenError` (400 `INVALID_RESET_TOKEN`).
- Hash new password with argon2id (before the transaction).
- Transaction: `updatePasswordHash` (sets or replaces; `provider` unchanged; `updatedAt` bumped), `markResetTokenUsed`, `revokeAllRefreshTokensForUser`.
- Returns `{ success: true }`. Does **not** issue a session and does not set a cookie.

### 6.5 `requireAuth` (Presentation, REQ-AUTH-08)

- Reads `Authorization` header; requires the exact `Bearer <token>` scheme.
- Verifies with `jose.jwtVerify` (HS256 only, `algorithms: ["HS256"]`), requires a string `sub`.
- Missing, malformed scheme, bad signature, wrong algorithm, expired, or missing `sub` → responds `401 { code: "UNAUTHENTICATED", message }` (via `UnauthenticatedError` → error handler).
- On success sets `req.userId = sub` and calls `next()`. No DB lookup (stateless); handlers pass `userId` to services as a plain argument.
- Exported for every other feature's router. Applied to `GET /auth/me` in this feature.

---

## 7. Domain Errors & HTTP Mapping

| Domain error class        | `code`                 | HTTP | Raised by                                               |
| :------------------------ | :--------------------- | :--- | :------------------------------------------------------ |
| (request validation)      | `VALIDATION_ERROR`     | 400  | ts-rest request validation handler (with `fieldErrors`) |
| `InvalidResetTokenError`  | `INVALID_RESET_TOKEN`  | 400  | `resetPassword`                                         |
| `InvalidCredentialsError` | `INVALID_CREDENTIALS`  | 401  | `login`                                                 |
| `InvalidGoogleTokenError` | `INVALID_GOOGLE_TOKEN` | 401  | `loginWithGoogle`                                       |
| `UnauthenticatedError`    | `UNAUTHENTICATED`      | 401  | `requireAuth`, `refreshSession`, `getCurrentUser`       |
| `EmailAlreadyExistsError` | `EMAIL_ALREADY_EXISTS` | 409  | `register`                                              |
| (unexpected)              | see Open Q-3           | 500  | error handler fallback; no stack/internal detail leaked |

- All error bodies: `{ code: string, message: string }`, plus `fieldErrors: Record<string, string>` only for `VALIDATION_ERROR`.
- Domain errors are HTTP-agnostic; the code → status mapping lives only in the Presentation error handler.
- `refreshSession` failures additionally **clear** the `refresh_token` cookie (same attributes, `Max-Age=0`/expired) before responding 401.

---

## 8. Validation Rules (authoritative, Zod — defined once in `packages/contracts`)

The Zod request schemas and their messages live in `packages/contracts` (FDS §5 "Field messages are defined once, in the shared schemas"), are consumed by the ts-rest Express adapter for request validation, and are the same objects the frontend imports. The backend does not redefine them.

| Field                              | Rules, in evaluation order → message (first failing rule wins)                                                                                                                                                                                         |
| :--------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                             | missing/empty → `Name is required.`; length < 2 → `Name must be at least 2 characters.`                                                                                                                                                                |
| `email`                            | missing/empty → `Email is required.`; not `name@domain.tld` → `Enter a valid email address.`                                                                                                                                                           |
| `password` (strong: signup, reset) | missing/empty → `Password is required.`; length < 8 → `Password must be at least 8 characters.`; no `[0-9]` → `Password must include a number.`; no char outside `[A-Za-z0-9]` (space/underscore count) → `Password must include a special character.` |
| `password` (login)                 | missing/empty → `Password is required.` (no strength rule)                                                                                                                                                                                             |
| `confirmPassword`                  | missing/empty → `Please confirm your password.`; `!== password` → `Passwords do not match.` (issue path `confirmPassword`)                                                                                                                             |

Per-operation body fields:

| Operation                                    | Validated fields                                               |
| :------------------------------------------- | :------------------------------------------------------------- |
| `register`                                   | `name`, `email`, `password` (strong), `confirmPassword`        |
| `login`                                      | `email`, `password` (non-empty only)                           |
| `googleOAuthLogin`                           | `token` (non-empty string; see Open Q-2)                       |
| `requestPasswordReset`                       | `email`                                                        |
| `resetPassword`                              | `token` (see Open Q-2), `password` (strong), `confirmPassword` |
| `refreshSession`, `logout`, `getCurrentUser` | no body                                                        |

Backend validation-mapping requirements:

- A custom ts-rest `requestValidationErrorHandler` converts the Zod error into `400 { code: "VALIDATION_ERROR", message: "Request validation failed.", fieldErrors }`, where `fieldErrors[field]` is the **first** issue message for that field (by Zod issue order).
- Missing fields (`invalid_type`, received `undefined`) must produce the "required" message, not Zod's default `Required` — schemas must set `required_error`/`invalid_type_error` (or `.min(1, msg)` after a string coercion) so the FDS text is emitted.
- The `confirmPassword` mismatch refinement must still run when other fields have non-fatal issues (so a short password and a mismatched confirmation both report).
- Non-JSON / malformed JSON bodies → `400 VALIDATION_ERROR` (handled by the error handler catching `express.json` `SyntaxError`), not 500.
- Email lower-casing is re-applied in the service regardless of any contract transform.

---

## 9. Proposed Routes (plain field lists — Synthesizer formalizes the contract)

All routes are mounted under `/api/v1/auth`. Shared public `user` = `{ id, name, email }` (never `passwordHash`, `googleId`, `provider`, timestamps).

| #   | Intent                                                                    | Method & path           | Auth                   | Reads (input)                                        | Writes (DB)                                                                                          | Success output                                                         | Error conditions                                                                                                                                            |
| --- | ------------------------------------------------------------------------- | ----------------------- | ---------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Register a new email/password account and start a session                 | `POST /signup`          | Public                 | body: `name`, `email`, `password`, `confirmPassword` | insert `users` (provider `email`), insert `refresh_tokens`                                           | `201`: `user`, `accessToken`, `expiresIn` + set `refresh_token` cookie | 400 `VALIDATION_ERROR`; 409 `EMAIL_ALREADY_EXISTS` (any existing account with that email, incl. Google-created)                                             |
| 2   | Sign in with email/password                                               | `POST /login`           | Public                 | body: `email`, `password`                            | insert `refresh_tokens`                                                                              | `200`: `user`, `accessToken`, `expiresIn` + cookie                     | 400 `VALIDATION_ERROR`; 401 `INVALID_CREDENTIALS` (unknown email / wrong password / no password — indistinguishable)                                        |
| 3   | Sign in, link, or provision via Google ID token                           | `POST /google`          | Public                 | body: `token` (Google ID token)                      | maybe update `users.google_id` (link) or insert `users` (provider `google`); insert `refresh_tokens` | `200`: `user`, `accessToken`, `expiresIn` + cookie                     | 400 `VALIDATION_ERROR` (empty body field, see Q-2); 401 `INVALID_GOOGLE_TOKEN` (verification failure, `email_verified !== true`, or conflicting `googleId`) |
| 4   | Rotate refresh token and issue a new access token (session restore/renew) | `POST /refresh`         | Cookie                 | cookie `refresh_token`                               | revoke presented token; insert new token                                                             | `200`: `user`, `accessToken`, `expiresIn` + rotated cookie             | 401 `UNAUTHENTICATED` (missing/unknown/revoked/expired cookie, or user gone) + cookie cleared                                                               |
| 5   | Return the authenticated user                                             | `GET /me`               | Bearer (`requireAuth`) | header `Authorization: Bearer`                       | —                                                                                                    | `200`: `user`                                                          | 401 `UNAUTHENTICATED`                                                                                                                                       |
| 6   | End the session                                                           | `POST /logout`          | Cookie (optional)      | cookie `refresh_token` if present                    | revoke presented token if valid                                                                      | `200`: `success: true` + cleared cookie                                | none — always 200, even with no/invalid cookie                                                                                                              |
| 7   | Request a password reset link                                             | `POST /forgot-password` | Public                 | body: `email`                                        | if user exists: mark earlier unused reset tokens used; insert `password_reset_tokens`; call `Mailer` | `200`: `success: true`, `message` (generic, identical for all emails)  | 400 `VALIDATION_ERROR` only                                                                                                                                 |
| 8   | Set a new password with a reset token                                     | `POST /reset-password`  | Public                 | body: `token`, `password`, `confirmPassword`         | update `users.password_hash`; mark reset token used; revoke all user refresh tokens                  | `200`: `success: true` (no session, no cookie)                         | 400 `VALIDATION_ERROR`; 400 `INVALID_RESET_TOKEN` (unknown/expired/used)                                                                                    |

Cookie attributes (set on routes 1–4, cleared on 4-failure and 6): `HttpOnly`, `SameSite=Lax`, `Path=/api/v1/auth`, `Max-Age=604800` (0 when clearing), `Secure` iff `NODE_ENV=production`. The raw refresh token never appears in any response body.

Every protected endpoint of other features must be mounted behind `requireAuth` and declare a `401` response using the shared error shape; the backend fragment expects a reusable shared error schema (`{ code, message, fieldErrors? }`) to be exported from `packages/contracts` for that purpose.

---

## 10. App-Level Changes (`backend/src/index.ts` / `app.ts`)

1. Split into `createApp(deps)` (no `listen`) and `index.ts` (bootstrap + `listen(PORT)`), so API tests can start the app on port `0`.
2. CORS middleware changes (keep hand-rolled; no `cors` package is approved):
   - `Access-Control-Allow-Origin: <FRONTEND_ORIGIN>` (exact, never `*`),
   - add `Access-Control-Allow-Credentials: true`,
   - `Access-Control-Allow-Headers: Content-Type, Authorization`,
   - keep methods `GET, POST, PATCH, DELETE, OPTIONS`; `OPTIONS` → 204.
   - add `Vary: Origin`.
3. Middleware order: CORS → `express.json()` → `cookieParser()` → ts-rest routers → JSON 404 → error handler.
4. Keep `GET /health` unchanged.
5. Env config (`config/env.ts`), validated with Zod at startup — fail fast with a clear message:
   - `JWT_SECRET` (required; recommend min length 32),
   - `GOOGLE_CLIENT_ID` (required for `/google`; see Open Q-4),
   - `FRONTEND_ORIGIN` (default `http://localhost:3000`, existing behaviour),
   - `NODE_ENV` (drives `Secure` cookie flag),
   - `DATABASE_PATH` (default `data/app.db`),
   - `PORT` (default `4000`).

---

## 11. Backend Test Requirements

Framework: Vitest (`backend/vitest.config.ts`), coverage via `@vitest/coverage-v8`, target **≥ 95%** lines for auth backend code. Each test sets up and tears down its own data (fresh `:memory:` DB with migrations applied). A fixed/advanceable `Clock`, a capturing `Mailer`, and a fake `GoogleTokenVerifier` are injected; no network access. Argon2 may use reduced cost parameters in tests only via config, never in production defaults.

### 11.1 Unit tests — pure functions & ports

- `resolveGoogleName`: trimmed name ≥ 2 used; name absent → email local part; name `" A "` (trims to 1 char) → local part; local part 1 char and no name → `"User"`.
- Token generator: raw refresh/reset token is 256-bit base64url (43 chars, URL-safe charset); `sha256` hash is deterministic hex and differs from raw.
- `JoseAccessTokenSigner`: signs HS256 with `sub`, `exp = iat + 900`; verify rejects wrong secret, expired token (clock), `alg: none`/other algorithms, missing `sub`.
- `Argon2PasswordHasher`: hash is argon2id (`$argon2id$` prefix); verify true/false.
- `ConsoleMailer`: logs a line containing the reset URL.
- `GoogleAuthLibraryVerifier`: with `OAuth2Client.verifyIdToken` stubbed — passes `audience = GOOGLE_CLIENT_ID`; thrown verification error → maps to invalid; payload `email_verified: false` or missing → invalid.

### 11.2 Unit tests — validation schemas (contracts package tests, backend-owned behaviour)

For each field in §8: every rule produces exactly its FDS message; first-failing-rule ordering (e.g. `""` → "Password is required." not "at least 8"); `"abcdefg1"` → special-character message; `"abcdefgh!"` → number message; `"abcdef1 "` (space) and `"abcdef1_"` (underscore) pass the special-character rule; non-ASCII letter (e.g. `é`) counts as special; missing field (`undefined`) → required message; `confirmPassword` mismatch → "Passwords do not match."; login schema accepts `"x"` as password; email with uppercase passes validation.

### 11.3 Service tests (in-memory DB, real repositories)

**Register:** creates user with `provider: "email"`, lowercase email, argon2id hash (not plaintext), `googleId: null`; returns public `user` only; issues access token + stores hashed refresh token; duplicate email (email account) → `EmailAlreadyExistsError`; duplicate email with different case → conflict; email belonging to a Google-created account → conflict; simulated unique-violation race → `EmailAlreadyExistsError`; no profile row created (no profile table touched).

**Login:** valid credentials succeed; email case-insensitive; unknown email, wrong password, Google-only account (null hash) each throw `InvalidCredentialsError` with identical `code` and `message`.

**Google:** existing `googleId` → signs in without writes; existing email account with null `googleId` → links (`googleId` set, `provider` stays `"email"`, `passwordHash` kept, `updatedAt` bumped); existing email account with a different `googleId` → `InvalidGoogleTokenError` and account unchanged (assert row equality); unknown email → creates `provider: "google"`, `passwordHash: null`, name resolved; verifier failure → `InvalidGoogleTokenError`; `email_verified: false` → `InvalidGoogleTokenError` and no user created; token email uppercase → matched against lowercase account.

**Refresh:** valid token → new access token, old token `revokedAt` set, new token row stored, returned raw token differs; reusing the old (rotated) token → `UnauthenticatedError`; expired token (clock advanced past 7 days) → `UnauthenticatedError`; unknown token → `UnauthenticatedError`; missing token → `UnauthenticatedError`; new token `expiresAt = now + 7d`.

**Logout:** valid token revoked; unknown/missing/already-revoked token → resolves without error.

**Get current user:** existing user returned; unknown `userId` → `UnauthenticatedError`.

**Forgot password:** unknown email → generic result, no token row, mailer not called; existing email → one token row (hashed), `expiresAt = now + 30 min`, mailer called once with `<FRONTEND_ORIGIN>/reset-password?token=<raw>` where `sha256(raw)` matches the stored hash; second request → first token `usedAt` set, only newest valid; Google-only account → token issued; response identical in all cases.

**Reset password:** valid token → hash replaced (old password no longer verifies, new one does), token `usedAt` set, **all** of the user's refresh tokens revoked (seed several); Google-only account → `passwordHash` set, `provider` still `"google"`, can then log in with email/password; reused token → `InvalidResetTokenError`; token at exactly/after 30 min → `InvalidResetTokenError`; unknown token → `InvalidResetTokenError`; earlier token invalidated by a newer request → `InvalidResetTokenError`; no session issued.

### 11.4 Repository tests

- `createUser` returns `EMAIL_TAKEN` on duplicate email instead of throwing; `google_id` uniqueness enforced; CHECK constraint rejects a row with neither `password_hash` nor `google_id`.
- `findRefreshTokenByHash` / `findResetTokenByHash` return null for unknown hashes.
- `revokeAllRefreshTokensForUser` affects only that user's tokens.
- `invalidateUnusedResetTokensForUser` leaves already-used tokens' `usedAt` unchanged.
- Transaction rollback: a failure mid reset-password leaves hash, token and refresh tokens unchanged.

### 11.5 API / integration tests (global `fetch`, app on ephemeral port)

For each route in §9: success status + body shape; the refresh token is **absent** from every JSON body; exact error `code` + status for each error row.

Specific cases:

- **Cookie attributes:** `Set-Cookie` for `refresh_token` has `HttpOnly`, `SameSite=Lax`, `Path=/api/v1/auth`, `Max-Age=604800`, no `Secure` when `NODE_ENV!=production`, `Secure` when `NODE_ENV=production`.
- **Signup:** `201`; validation failure returns `400 VALIDATION_ERROR` with `fieldErrors` containing FDS messages verbatim (one message per field); missing body fields → "required" messages; malformed JSON → `400`; duplicate → `409 EMAIL_ALREADY_EXISTS`.
- **Login:** `200` + cookie; unknown email / wrong password / Google-only → identical `401` bodies (deep-equal).
- **Google:** with fake verifier: new account `200`; link `200`; conflicting `googleId` `401 INVALID_GOOGLE_TOKEN`; unverified email `401`.
- **Refresh:** with cookie → `200`, new cookie value differs; old cookie replayed → `401 UNAUTHENTICATED` and `Set-Cookie` clears `refresh_token`; no cookie → `401` + clear.
- **Me:** valid Bearer → `200 user`; no header, `Basic` scheme, garbage token, token signed with another secret, expired token (clock) → `401 UNAUTHENTICATED`.
- **Logout:** with cookie → `200 { success: true }` + cleared cookie; subsequent `/refresh` with the old cookie → `401` (FDS AC); logout with no cookie → `200`.
- **Forgot password:** registered vs unregistered email → byte-identical `200` bodies; registered email → capturing mailer received the URL; invalid email → `400 VALIDATION_ERROR`.
- **Reset password:** success `200`; second use of same token → `400 INVALID_RESET_TOKEN`; after clock +30 min → `400 INVALID_RESET_TOKEN`; after success, all previously issued refresh cookies → `401` on `/refresh`; login with new password succeeds and old fails.
- **requireAuth contract for other features:** a test-only route mounted behind `requireAuth` receives `req.userId` equal to the JWT `sub`, and returns `401 UNAUTHENTICATED` without a valid token.
- **CORS:** preflight `OPTIONS` from `FRONTEND_ORIGIN` → `204` with `Access-Control-Allow-Credentials: true` and `Authorization` in allowed headers; `Access-Control-Allow-Origin` equals `FRONTEND_ORIGIN` exactly.
- **Error handler:** a forced unexpected error yields `500 { code, message }` without stack traces.
- **Health:** `GET /health` unchanged.

### 11.6 Acceptance-criteria traceability (backend-verifiable ACs)

| FDS §7 acceptance criterion                                     | Covered by                     |
| :-------------------------------------------------------------- | :----------------------------- |
| Register with valid data                                        | 11.3 Register, 11.5 Signup     |
| Existing email → 409                                            | 11.3, 11.5                     |
| Sign-in yields refresh cookie + access token                    | 11.5 Login, cookie attributes  |
| Sign-in failure never reveals email existence / Google-only     | 11.3 Login, 11.5 Login         |
| Google links existing email / creates unknown                   | 11.3 Google, 11.5 Google       |
| `requestPasswordReset` same response; registered email logs URL | 11.3, 11.5, 11.1 ConsoleMailer |
| Reset link single-use, 30-min expiry, ends sessions             | 11.3 Reset, 11.5 Reset         |
| Logout revokes; later refresh with old cookie → 401             | 11.5 Logout                    |
| Protected API endpoints → 401 without valid Bearer              | 11.5 Me, requireAuth contract  |

---

## 12. Open Questions for the Synthesizer (non-blocking)

1. **Root-level files outside backend's path boundary.** `argon2` needs `allowBuilds: argon2: true` in the root `pnpm-workspace.yaml` (FDS §2 approves this), and `.env.example` (root) should gain `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `NODE_ENV`. Backend Build may only touch `backend/` and `packages/contracts/`. The Synthesizer should assign these root edits to a phase (e.g. Integration) or explicitly authorize them for Backend Build.
2. **Empty `token` in `/google` and `/reset-password` bodies.** FDS §5 defines no field message for `token`. Proposal: `token` is a required string; an empty/missing `token` returns `400 VALIDATION_ERROR` with `fieldErrors.token` (message to be fixed in contracts, e.g. `"Token is required."`) — or, alternatively, treated as an unknown token (`401 INVALID_GOOGLE_TOKEN` / `400 INVALID_RESET_TOKEN`). The frontend never sends an empty reset token (it short-circuits), so either choice is safe; the Synthesizer should pick one and fix it in the contract.
3. **Error `code` for unexpected 500s and unknown routes.** Not defined by FDS §6. Proposal: `500 { code: "INTERNAL_ERROR", message: "An unexpected error occurred." }` and `404 { code: "NOT_FOUND", ... }`.
4. **Missing `GOOGLE_CLIENT_ID` at startup.** Proposal: required in production; in development/test, allow startup and make `/google` reject with `401 INVALID_GOOGLE_TOKEN` (so local dev without Google still works). Confirm or make it strictly required.
5. **Whitespace handling for `name` and `email`.** FDS specifies trimming only for the Google `name` claim and lower-casing for email. Proposal: trim `name` and `email` in the shared schema before validating (so `"  "` → `Name is required.`), and persist trimmed values. Confirm.
6. **Google-create vs concurrent register race.** Proposal in §6.3 step 3: on `EMAIL_TAKEN` during Google provisioning, retry resolution once through the link path. Confirm this is acceptable (otherwise it is a 500 in a very narrow race).
7. **Concurrent refresh from two tabs.** Strict rotation means the second simultaneous `/refresh` with the same cookie gets `401`. The FDS mandates strict rotation and no grace window, so the backend implements it as specified; the Synthesizer should make sure the frontend side serializes refresh calls.
8. **Upper length bounds.** FDS sets no max length for `name`, `email` or `password`. Proposal: none added beyond `express.json()`'s default 100 kB body limit (avoids inventing new validation messages).
