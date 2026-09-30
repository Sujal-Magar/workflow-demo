# API Contract: auth (v1.0.0)

- **Feature:** `auth` (Authentication and Identity)
- **FDS version:** 1.0.0 (`features/auth/fds.md`)
- **Produced by:** Plan Synthesizer, from `fragments/frontend.md` §13 and `fragments/backend.md` §7–§9
- **Status:** Draft. Frozen at the Developer Approval Gate (Phase 4). After that, Frontend Build, Backend Build and Integration build against this file as written. Neither side may edit it.
- **Companion plan:** `plan.md` (same directory)

This document is the only source of truth for the Frontend/Backend interface of `auth`. It is plain language on purpose and does not assume any framework. Turning it into the project's typed contract package is a Backend Build task (see `plan.md`, task BE-03).

---

## 1. General Conventions

| Topic               | Rule                                                                                                                                                                                                                                                        |
| :------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base path           | Every operation is served under `/api/v1/auth`. Paths below are relative to it (for example `/signup` means `/api/v1/auth/signup`).                                                                                                                         |
| Body format         | Request and response bodies are JSON objects (`Content-Type: application/json`). Operations marked "no body" ignore any body that is sent.                                                                                                                  |
| Unknown body fields | Ignored. They never cause an error and are never echoed back.                                                                                                                                                                                               |
| Credentials         | The client sends **every** request to this API with credentials included, so the browser attaches the refresh cookie on the operations whose path it covers.                                                                                                |
| Access token        | Sent as the request header `Authorization: Bearer <accessToken>` on protected operations. The client may attach it to any request. Public and cookie operations ignore it.                                                                                  |
| Refresh token       | Lives only in the HTTP-only cookie described in §4. It **never** appears in any request body or response body.                                                                                                                                              |
| Timestamps          | No operation in this contract returns a timestamp.                                                                                                                                                                                                          |
| Undeclared outcomes | The client treats any status or `code` not declared for an operation (including network failure and any `5xx`) as "unexpected" and applies the FDS §5 Generic Failure Feedback. The server never returns a `2xx` other than the one declared per operation. |

---

## 2. Shared Shapes

### 2.1 `PublicUser`

| Field   | Type        | Notes                                     |
| :------ | :---------- | :---------------------------------------- |
| `id`    | UUID string | Account primary key                       |
| `name`  | string      | Display name, as stored (already trimmed) |
| `email` | string      | Always lowercase                          |

No other field is ever included. In particular, the password hash, Google ID, provider and timestamps never leave the server.

### 2.2 `SessionPayload` (returned by every operation that starts or renews a session)

| Field         | Type              | Notes                                                                                                                            |
| :------------ | :---------------- | :------------------------------------------------------------------------------------------------------------------------------- |
| `user`        | `PublicUser`      | The signed-in account                                                                                                            |
| `accessToken` | string            | Short-lived access credential. The client treats it as opaque and keeps it in memory only (never Web Storage, never a cookie).   |
| `expiresIn`   | integer (seconds) | Lifetime of `accessToken` from the moment of the response. Always `900` in v1.0.0. The client schedules renewal from this value. |

### 2.3 `SuccessAck`

| Field     | Type    | Notes         |
| :-------- | :------ | :------------ |
| `success` | boolean | Always `true` |

### 2.4 `ForgotPasswordAck`

| Field     | Type    | Notes                                                                                             |
| :-------- | :------ | :------------------------------------------------------------------------------------------------ |
| `success` | boolean | Always `true`                                                                                     |
| `message` | string  | Always exactly `If an account exists for that email, a reset link has been sent.` for every input |

### 2.5 `ErrorBody` (every non-`2xx` response from this API)

| Field         | Type                        | Present                                                                  | Notes                                                                                                                                                                                                                                   |
| :------------ | :-------------------------- | :----------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `code`        | string (one of §3)          | Always                                                                   | Machine-readable. The client branches on status **and** `code`.                                                                                                                                                                         |
| `message`     | string                      | Always                                                                   | Fixed English text per code (§3). Informational only; the client never shows it to the user.                                                                                                                                            |
| `fieldErrors` | map of field name → message | Only when `code` is `VALIDATION_ERROR` (and then always, possibly empty) | One entry per failing field, holding the message of the **first** failing rule for that field (§5). Keys are body field names exactly as sent (`name`, `email`, `password`, `confirmPassword`, `token`). Fields that passed are absent. |

No stack trace, SQL text or internal detail is ever included.

---

## 3. Error Code Catalog

| Code                   | Status | Fixed `message`                              | Meaning                                                                                                                                                                                                                                           |
| :--------------------- | :----- | :------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `VALIDATION_ERROR`     | 400    | `Request validation failed.`                 | The request body failed the rules in §5, or was not valid JSON. Carries `fieldErrors` (empty map when the body could not be parsed at all).                                                                                                       |
| `INVALID_RESET_TOKEN`  | 400    | `This reset link is invalid or has expired.` | Reset token unknown, expired (30 minutes after issue) or already used (including one superseded by a newer reset request).                                                                                                                        |
| `INVALID_CREDENTIALS`  | 401    | `Invalid email or password.`                 | Login failed. Identical status, code and message for an unknown email, a wrong password and an account without a password (anti-enumeration).                                                                                                     |
| `INVALID_GOOGLE_TOKEN` | 401    | `Google sign-in failed.`                     | Google ID token failed verification, `email_verified` was not `true`, its Google identity conflicts with the one linked to that email's account, or Google sign-in is not configured on the server.                                               |
| `UNAUTHENTICATED`      | 401    | `Authentication required.`                   | Missing, malformed, invalid or expired access token on a protected operation; or missing, unknown, revoked or expired refresh cookie; or the account no longer exists. **This is the only code that may trigger the client's refresh-and-retry.** |
| `EMAIL_ALREADY_EXISTS` | 409    | `An account with this email already exists.` | Sign-up with an email that already belongs to any account (email- or Google-created).                                                                                                                                                             |
| `NOT_FOUND`            | 404    | `Route not found.`                           | No operation matches the method and path. Not declared by any operation below; listed so the shape is fixed.                                                                                                                                      |
| `INTERNAL_ERROR`       | 500    | `An unexpected error occurred.`              | Any unexpected server failure. May be returned by any operation.                                                                                                                                                                                  |

---

## 4. Refresh Cookie

| Attribute | Value                                                                                      |
| :-------- | :----------------------------------------------------------------------------------------- |
| Name      | `refresh_token`                                                                            |
| Value     | Opaque 256-bit random value, base64url encoded (43 characters). The client never reads it. |
| HttpOnly  | Yes                                                                                        |
| SameSite  | `Lax`                                                                                      |
| Path      | `/api/v1/auth` (covers `/refresh` and `/logout`)                                           |
| Max-Age   | `604800` (7 days) when set; `0` when cleared                                               |
| Secure    | Present only when the server runs with `NODE_ENV=production`                               |

- **Set** (new value) by: `register`, `login`, `googleOAuthLogin`, and a successful `refreshSession`.
- **Cleared** (same name, path and flags, `Max-Age=0`) by: a failed `refreshSession` (401) and every `logout` response.
- **Rotation:** every successful `refreshSession` revokes the presented value and sets a new one. Presenting an already-rotated value returns `401 UNAUTHENTICATED`. There is no grace window, so the client must never run two refreshes at once (see `plan.md` FE-10).
- **Deployment note:** because the cookie is `SameSite=Lax`, the frontend and API origins must be same-site. `http://localhost:3000` and `http://localhost:4000` are same-site (ports do not affect "site").

---

## 5. Shared Validation Rule Sets

These rule sets are defined **once** in the shared contract package. The frontend uses them for inline validation and the backend uses them to validate requests, so both sides produce the same message for the same input (FDS §5 "Validation Messages").

**Evaluation:** rules for a field are checked in the order listed, and the **first** failing rule is the only message reported for that field. Every field is checked independently, so one request can report errors on several fields at once. The `confirmPassword` match rule is still checked when other fields have failed, as long as `password` and `confirmPassword` are both present strings.

**Normalization before checking:** `name` and `email` have leading and trailing whitespace removed first (so `"   "` counts as empty), and the trimmed value is what gets stored. Lowercasing `email` is **not** part of the shared rules: the server lowercases it before every lookup and before storing (FDS §3), so `Piyush@Example.com` passes validation and matches `piyush@example.com`. Passwords and tokens are never trimmed or altered.

**Missing or wrong-type values:** a field that is absent, `null`, or not a string is treated exactly as an empty string for message purposes (it reports the "empty" message below, never a generic type error).

| Rule set          | Field(s)          | Rules in order → message                                                                                                                                                                                                                                                                                                                 |
| :---------------- | :---------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Name`            | `name`            | 1. empty → `Name is required.` 2. fewer than 2 characters → `Name must be at least 2 characters.`                                                                                                                                                                                                                                        |
| `Email`           | `email`           | 1. empty → `Email is required.` 2. not of the form `local@domain.tld` → `Enter a valid email address.`                                                                                                                                                                                                                                   |
| `StrongPassword`  | `password`        | 1. empty → `Password is required.` 2. fewer than 8 characters → `Password must be at least 8 characters.` 3. no ASCII digit `0–9` → `Password must include a number.` 4. no character outside `A–Z`, `a–z`, `0–9` → `Password must include a special character.` (Space, underscore and non-ASCII letters such as `é` count as special.) |
| `LoginPassword`   | `password`        | 1. empty → `Password is required.` No other rule (no strength check on existing credentials).                                                                                                                                                                                                                                            |
| `ConfirmPassword` | `confirmPassword` | 1. empty → `Please confirm your password.` 2. not exactly equal to `password` → `Passwords do not match.` (reported on `confirmPassword`)                                                                                                                                                                                                |
| `Token`           | `token`           | 1. empty → `Token is required.` This field is never typed by the user; the message is for API consumers only.                                                                                                                                                                                                                            |

**Composed request rule sets (what each operation validates):**

| Composed set            | Fields → rule set                                                                                | Used by                                                          |
| :---------------------- | :----------------------------------------------------------------------------------------------- | :--------------------------------------------------------------- |
| `SignUpRequest`         | `name` → Name; `email` → Email; `password` → StrongPassword; `confirmPassword` → ConfirmPassword | `register`, Sign Up form                                         |
| `SignInRequest`         | `email` → Email; `password` → LoginPassword                                                      | `login`, Sign In form                                            |
| `GoogleSignInRequest`   | `token` → Token                                                                                  | `googleOAuthLogin`                                               |
| `ForgotPasswordRequest` | `email` → Email                                                                                  | `requestPasswordReset`, Forgot dialog                            |
| `NewPasswordFields`     | `password` → StrongPassword; `confirmPassword` → ConfirmPassword                                 | Reset Password form (the token comes from the URL, not the form) |
| `ResetPasswordRequest`  | `token` → Token, plus all of `NewPasswordFields`                                                 | `resetPassword`                                                  |

No maximum lengths are defined in v1.0.0 beyond the server's overall request-body size limit (100 kB; larger bodies are an unexpected failure to the client).

---

## 6. Operations

Every operation may also return `500 INTERNAL_ERROR`. It is not repeated in each table.

### 6.1 `register` — create an account and start a session

| Item          | Value                                                                                                      |
| :------------ | :--------------------------------------------------------------------------------------------------------- |
| Method & path | `POST /signup`                                                                                             |
| Auth          | Public                                                                                                     |
| Request body  | `SignUpRequest`: `name` (string), `email` (string), `password` (string), `confirmPassword` (string)        |
| Success       | **`201`**, body `SessionPayload`, sets `refresh_token` cookie                                              |
| Side effects  | New account with `provider = "email"`, email stored lowercase, no Google ID. No profile record is created. |

| Status | `code`                 | When                                                  | `fieldErrors` keys                                    |
| :----- | :--------------------- | :---------------------------------------------------- | :---------------------------------------------------- |
| 400    | `VALIDATION_ERROR`     | Body fails `SignUpRequest` or is not valid JSON       | any of `name`, `email`, `password`, `confirmPassword` |
| 409    | `EMAIL_ALREADY_EXISTS` | The (normalized) email already belongs to any account | —                                                     |

### 6.2 `login` — sign in with email and password

| Item          | Value                                                     |
| :------------ | :-------------------------------------------------------- |
| Method & path | `POST /login`                                             |
| Auth          | Public                                                    |
| Request body  | `SignInRequest`: `email` (string), `password` (string)    |
| Success       | `200`, body `SessionPayload`, sets `refresh_token` cookie |

| Status | `code`                | When                                                                                                | `fieldErrors` keys  |
| :----- | :-------------------- | :-------------------------------------------------------------------------------------------------- | :------------------ |
| 400    | `VALIDATION_ERROR`    | Body fails `SignInRequest` or is not valid JSON                                                     | `email`, `password` |
| 401    | `INVALID_CREDENTIALS` | Unknown email, wrong password, or account with no password. The three responses are byte-identical. | —                   |

A `401 INVALID_CREDENTIALS` must reach the Sign In form unchanged. It never triggers refresh-and-retry.

### 6.3 `googleOAuthLogin` — sign in, link, or create an account with a Google ID token

| Item          | Value                                                                                                                                                                                                                                                                                                                                          |
| :------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Method & path | `POST /google`                                                                                                                                                                                                                                                                                                                                 |
| Auth          | Public                                                                                                                                                                                                                                                                                                                                         |
| Request body  | `GoogleSignInRequest`: `token` (string, the Google ID token / `credential`)                                                                                                                                                                                                                                                                    |
| Success       | `200`, body `SessionPayload`, sets `refresh_token` cookie                                                                                                                                                                                                                                                                                      |
| Side effects  | Per FDS REQ-AUTH-03 resolution order: (1) sign in the account with this Google ID; else (2) link the Google ID to the account with this email, keeping its provider and password; else (3) create a `provider = "google"` account with no password and a name resolved per REQ-AUTH-03. The client cannot and need not tell these three apart. |

| Status | `code`                 | When                                                                                                                                                                                   | `fieldErrors` keys |
| :----- | :--------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------- |
| 400    | `VALIDATION_ERROR`     | `token` missing or empty, or body is not valid JSON                                                                                                                                    | `token`            |
| 401    | `INVALID_GOOGLE_TOKEN` | Verification fails (signature, expiry, audience); `email_verified` not `true`; conflicting linked Google ID (no account is changed); or Google sign-in is not configured on the server | —                  |

### 6.4 `refreshSession` — restore or renew the session

| Item          | Value                                                                              |
| :------------ | :--------------------------------------------------------------------------------- |
| Method & path | `POST /refresh`                                                                    |
| Auth          | Refresh cookie                                                                     |
| Request       | No body. Reads the `refresh_token` cookie only.                                    |
| Success       | `200`, body `SessionPayload`, sets a **new** `refresh_token` cookie (rotation, §4) |

| Status | `code`            | When                                                                                                                                      | Cookie  |
| :----- | :---------------- | :---------------------------------------------------------------------------------------------------------------------------------------- | :------ |
| 401    | `UNAUTHENTICATED` | Cookie missing, empty, unknown, revoked (rotated, logged out, or revoked by a password reset) or expired; or its account no longer exists | Cleared |

Used by the client on application load (restore), before the access token expires (renew), and once after a `401 UNAUTHENTICATED` from a protected operation. A failed refresh itself is never retried.

### 6.5 `getCurrentUser` — read the signed-in user

| Item          | Value                                     |
| :------------ | :---------------------------------------- |
| Method & path | `GET /me`                                 |
| Auth          | Bearer access token (protected operation) |
| Request       | No body                                   |
| Success       | `200`, body `{ user: PublicUser }`        |

| Status | `code`            | When                                                                                                                                           |
| :----- | :---------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| 401    | `UNAUTHENTICATED` | `Authorization` header missing, not exactly the `Bearer <token>` scheme, token invalid/expired/wrongly signed, or the account no longer exists |

### 6.6 `logout` — end the session

| Item          | Value                                                                                                                                                |
| :------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| Method & path | `POST /logout`                                                                                                                                       |
| Auth          | Refresh cookie, optional                                                                                                                             |
| Request       | No body. Reads the `refresh_token` cookie if present.                                                                                                |
| Success       | `200`, body `SuccessAck`, **always** clears the `refresh_token` cookie                                                                               |
| Side effects  | If the cookie matches a stored, not-yet-revoked token, that token is revoked. A missing, unknown, expired or already-revoked cookie is not an error. |

No declared error responses (only the general `500`). The client clears its local session whatever the outcome.

### 6.7 `requestPasswordReset` — request a reset link

| Item          | Value                                                                                                                                                                                                                                                             |
| :------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Method & path | `POST /forgot-password`                                                                                                                                                                                                                                           |
| Auth          | Public                                                                                                                                                                                                                                                            |
| Request body  | `ForgotPasswordRequest`: `email` (string)                                                                                                                                                                                                                         |
| Success       | `200`, body `ForgotPasswordAck`. **Byte-identical** for registered, unregistered and Google-only emails.                                                                                                                                                          |
| Side effects  | Only when an account exists: every earlier unused reset token for it is invalidated, a new one is issued (valid 30 minutes), and the URL `<FRONTEND_ORIGIN>/reset-password?token=<rawToken>` is handed to the mail port (logged to the server console in v1.0.0). |

| Status | `code`             | When                                                    | `fieldErrors` keys |
| :----- | :----------------- | :------------------------------------------------------ | :----------------- |
| 400    | `VALIDATION_ERROR` | Body fails `ForgotPasswordRequest` or is not valid JSON | `email`            |

### 6.8 `resetPassword` — set a new password with a reset token

| Item          | Value                                                                                                                                                                                                                                                                  |
| :------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Method & path | `POST /reset-password`                                                                                                                                                                                                                                                 |
| Auth          | Public                                                                                                                                                                                                                                                                 |
| Request body  | `ResetPasswordRequest`: `token` (string, from the reset URL), `password` (string), `confirmPassword` (string)                                                                                                                                                          |
| Success       | `200`, body `SuccessAck`. **No** session is started and **no** cookie is set or cleared.                                                                                                                                                                               |
| Side effects  | Password hash set or replaced (provider unchanged), token marked used, **all** of the account's refresh tokens revoked. Access tokens already issued stay valid until they expire (at most 15 minutes); the next refresh from any other session then fails with `401`. |

| Status | `code`                | When                                                                                               | `fieldErrors` keys                     |
| :----- | :-------------------- | :------------------------------------------------------------------------------------------------- | :------------------------------------- |
| 400    | `VALIDATION_ERROR`    | Body fails `ResetPasswordRequest` or is not valid JSON. Checked **before** the token is looked up. | `token`, `password`, `confirmPassword` |
| 400    | `INVALID_RESET_TOKEN` | Body is valid, but the token is unknown, expired, already used or superseded                       | —                                      |

The client tells the two `400`s apart by `code`. A `fieldErrors.token` entry has no form field and is ignored by the Reset Password form.

---

## 7. Operation Summary

| Operation              | Method & path           | Auth              | Request body            | Success                 | Declared errors (besides 500)                      | Sets cookie   | Clears cookie |
| :--------------------- | :---------------------- | :---------------- | :---------------------- | :---------------------- | :------------------------------------------------- | :------------ | :------------ |
| `register`             | `POST /signup`          | Public            | `SignUpRequest`         | `201 SessionPayload`    | 400 `VALIDATION_ERROR`, 409 `EMAIL_ALREADY_EXISTS` | Yes           | No            |
| `login`                | `POST /login`           | Public            | `SignInRequest`         | `200 SessionPayload`    | 400 `VALIDATION_ERROR`, 401 `INVALID_CREDENTIALS`  | Yes           | No            |
| `googleOAuthLogin`     | `POST /google`          | Public            | `GoogleSignInRequest`   | `200 SessionPayload`    | 400 `VALIDATION_ERROR`, 401 `INVALID_GOOGLE_TOKEN` | Yes           | No            |
| `refreshSession`       | `POST /refresh`         | Cookie            | none                    | `200 SessionPayload`    | 401 `UNAUTHENTICATED`                              | Yes (rotated) | On 401        |
| `getCurrentUser`       | `GET /me`               | Bearer            | none                    | `200 { user }`          | 401 `UNAUTHENTICATED`                              | No            | No            |
| `logout`               | `POST /logout`          | Cookie (optional) | none                    | `200 SuccessAck`        | —                                                  | No            | Always        |
| `requestPasswordReset` | `POST /forgot-password` | Public            | `ForgotPasswordRequest` | `200 ForgotPasswordAck` | 400 `VALIDATION_ERROR`                             | No            | No            |
| `resetPassword`        | `POST /reset-password`  | Public            | `ResetPasswordRequest`  | `200 SuccessAck`        | 400 `VALIDATION_ERROR`, 400 `INVALID_RESET_TOKEN`  | No            | No            |

**Client retry rule (binding on the frontend):** only a `401` whose `code` is `UNAUTHENTICATED`, returned by a **protected** operation (in this feature, only `getCurrentUser`; later, every protected operation of other features), triggers one `refreshSession` followed by one retry of the original request. `register`, `login`, `googleOAuthLogin`, `refreshSession`, `logout`, `requestPasswordReset` and `resetPassword` are never retried.

---

## 8. Cross-Origin Requirements

The API answers requests from exactly one browser origin, `FRONTEND_ORIGIN` (default `http://localhost:3000`):

- `Access-Control-Allow-Origin` equals `FRONTEND_ORIGIN` exactly (never `*`), with `Vary: Origin`.
- `Access-Control-Allow-Credentials: true`.
- `Access-Control-Allow-Headers` includes `Content-Type` and `Authorization`.
- `Access-Control-Allow-Methods`: `GET, POST, PATCH, DELETE, OPTIONS`.
- A preflight `OPTIONS` request gets `204` with these headers and no body.

---

## 9. Contract for Other Features' Protected Operations (REQ-AUTH-08)

Every operation of every other feature is protected in the same way as `getCurrentUser`:

- It requires `Authorization: Bearer <accessToken>`.
- A missing, malformed, invalid or expired token returns `401` with an `ErrorBody` whose `code` is `UNAUTHENTICATED` and `message` is `Authentication required.`
- Each such feature's contract declares that `401` response using the `ErrorBody` shape from §2.5, and scopes all data to the authenticated user.
- The `ErrorBody` shape and the `UNAUTHENTICATED` code are exported from the shared contract package for reuse. Other features must not redefine them.

---

## 10. Conflict Resolutions Made During Synthesis

The fragments agreed on routes, methods, statuses, codes and the `user` / `accessToken` / `expiresIn` payload. These points were implied differently or left open, and were resolved as follows.

| #   | Topic                                                       | Frontend fragment                                                                                                      | Backend fragment                                                                                                    | Resolution in this contract and why                                                                                                                                                                                                                                                                                    |
| :-- | :---------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Empty or missing `token` on `/google` and `/reset-password` | Never sends an empty token (missing reset token short-circuits; missing Google `credential` is treated as a dismissal) | Offered either `400 VALIDATION_ERROR` or treating it as an unknown token                                            | **`400 VALIDATION_ERROR` with `fieldErrors.token = "Token is required."`** A missing body field is a body-validation failure, which FDS §6 assigns to `VALIDATION_ERROR`. No client path can trigger it, so no user-facing behavior changes. The message is API-only and is not added to the FDS §5 user-facing table. |
| C2  | Code for unexpected failures                                | Treats any unknown code, network error or `5xx` as "unexpected"                                                        | Proposed `500 INTERNAL_ERROR` and `404 NOT_FOUND`                                                                   | **Adopted as proposed.** FDS §6 requires every error to carry a `code`, so these fallbacks need one. Clients never branch on them.                                                                                                                                                                                     |
| C3  | `message` field content                                     | Uses its own UI copy per code and shows the server `message` only for the forgot-password success                      | Returns `{ code, message }`                                                                                         | **Fixed text per code (§3), informational only.** Keeps the anti-enumeration guarantee testable (identical bodies) and keeps all user-facing copy in the frontend copy catalog.                                                                                                                                        |
| C4  | Shape of validation errors                                  | Wants one message per form field, keyed by form field name                                                             | First issue per field, keyed by body field                                                                          | **Same thing.** Body field names equal form field names. `fieldErrors` is always present on `VALIDATION_ERROR` (empty map for unparseable JSON), so the client can rely on it.                                                                                                                                         |
| C5  | Whitespace in `name` and `email`                            | Sends email trimmed                                                                                                    | Proposed trimming `name` and `email` in the shared rules                                                            | **Trim both inside the shared rules (§5)** so the frontend and backend give the same verdict for `"   "` and store trimmed values. Passwords are never trimmed. Recorded as decision D-05 in `plan.md` for developer confirmation.                                                                                     |
| C6  | Google sign-in without server configuration                 | Shows "Google sign-in is unavailable." when the client ID is missing                                                   | Proposed rejecting `/google` with `401 INVALID_GOOGLE_TOKEN` when `GOOGLE_CLIENT_ID` is unset (non-production only) | **Adopted.** Uses an existing FDS code, and never verifies a token without an audience. The client already maps this code to "Google sign-in failed. Please try again."                                                                                                                                                |
| C7  | Concurrent refreshes                                        | Single-flight refresh on the client                                                                                    | Strict rotation, no grace window                                                                                    | **Strict rotation (FDS §3) stays.** The client obligation is written into §4 and §7.                                                                                                                                                                                                                                   |
| C8  | Shared rule sets for forms                                  | Needs the reset form's rules without the `token` field                                                                 | Validates `token` + password + confirm                                                                              | **Two composed sets:** `NewPasswordFields` (form) and `ResetPasswordRequest` (request) built from it (§5).                                                                                                                                                                                                             |

---

## 11. Blocking Items for Plan Review

None. No conflict required inventing a requirement that the FDS does not imply. Choices that the developer should explicitly confirm at the Approval Gate are starred (★) in `plan.md` §1 (Decision Log).
