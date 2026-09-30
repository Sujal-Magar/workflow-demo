---
id: auth
title: Authentication and Identity
status: active
version: 1.0.0
owner: security-team
last_updated: 2026-09-24
coverage_target: 95
compliance_relevant: true
dependencies: []
changelog:
  - version: 1.0.0
    date: 2026-09-22
    summary: "Initial specification for FinTrack user authentication, email/password signup & login, Google OAuth SSO, and session management"
---

# Feature Specification: Authentication and Identity

## 1. Overview

The Authentication module provides the secure entry point for the FinTrack application. It enables new user registration (Sign Up), returning user authentication (Sign In), third-party federated identity through Google OAuth SSO, password recovery, and active session credential management. Because every personal finance record must be bound to an authenticated identity, `auth` serves as the foundational root dependency across the platform.

## 2. Approved Libraries

These libraries are explicitly approved for this feature and are additions to the base stack in `rules/tech-stack.md`. No other new libraries are approved.

| Purpose                                      | Library                | Layer    | Notes                                                      |
| :------------------------------------------- | :--------------------- | :------- | :--------------------------------------------------------- |
| Password hashing                             | `argon2`               | Backend  | argon2id variant                                           |
| JWT signing and verification                 | `jose`                 | Backend  | HS256; secret read from `JWT_SECRET` env var               |
| Google ID-token verification                 | `google-auth-library`  | Backend  | Audience checked against `GOOGLE_CLIENT_ID` env var        |
| Refresh cookie parsing                       | `cookie-parser`        | Backend  | Express middleware                                         |
| Refresh cookie parser typings                | `@types/cookie-parser` | Backend  | Dev dependency, types only (required by strict TypeScript) |
| Google sign-in button / ID-token acquisition | `@react-oauth/google`  | Frontend | Client ID read from `NEXT_PUBLIC_GOOGLE_CLIENT_ID` env var |

Implementation constraints on the approved libraries:

- `jose` must be a 5.x release, because the backend compiles to CommonJS and later majors are ESM-only.
- `argon2` is a native module. Approving it includes allowing its pnpm build script to run in the workspace.
- No HTTP test client (e.g. `supertest`) is approved. Backend API tests use Node's global `fetch` against an app started on an ephemeral port.

## 3. Data Model

### User Account Entity (`UserAuth`)

| Field          | Type          | Required | Description                                                                                                        |
| :------------- | :------------ | :------- | :----------------------------------------------------------------------------------------------------------------- |
| `id`           | UUID string   | Yes      | Unique identifier (Primary Key)                                                                                    |
| `name`         | string        | Yes      | User display name (e.g., "Piyush Kumar")                                                                           |
| `email`        | string        | Yes      | Unique, valid email address (normalized to lowercase)                                                              |
| `passwordHash` | string        | No       | argon2id hash. `null` for accounts created through Google that have never set a password                           |
| `provider`     | enum          | Yes      | Method the account was originally created with (`"email"` or `"google"`); does not change when accounts are linked |
| `googleId`     | string        | No       | Google account identifier (`sub` claim). Set for Google-created accounts and for email accounts linked to Google   |
| `createdAt`    | ISO Timestamp | Yes      | Account creation timestamp                                                                                         |
| `updatedAt`    | ISO Timestamp | Yes      | Last account modification timestamp                                                                                |

An account may have a `passwordHash`, a `googleId`, or both. It always has at least one of the two.

### Refresh Token Entity (`RefreshToken`)

| Field       | Type          | Required | Description                                                      |
| :---------- | :------------ | :------- | :--------------------------------------------------------------- |
| `id`        | UUID string   | Yes      | Primary Key                                                      |
| `userId`    | UUID string   | Yes      | Reference to `UserAuth.id`                                       |
| `tokenHash` | string        | Yes      | SHA-256 hash of the opaque token. The raw token is never stored  |
| `expiresAt` | ISO Timestamp | Yes      | Issue time + 7 days                                              |
| `revokedAt` | ISO Timestamp | No       | Set when the token is rotated, logged out, or revoked by a reset |
| `createdAt` | ISO Timestamp | Yes      | Issue timestamp                                                  |

### Password Reset Token Entity (`PasswordResetToken`)

| Field       | Type          | Required | Description                                                     |
| :---------- | :------------ | :------- | :-------------------------------------------------------------- |
| `id`        | UUID string   | Yes      | Primary Key                                                     |
| `userId`    | UUID string   | Yes      | Reference to `UserAuth.id`                                      |
| `tokenHash` | string        | Yes      | SHA-256 hash of the opaque token. The raw token is never stored |
| `expiresAt` | ISO Timestamp | Yes      | Issue time + 30 minutes                                         |
| `usedAt`    | ISO Timestamp | No       | Set when the token is consumed; a used token is invalid         |
| `createdAt` | ISO Timestamp | Yes      | Issue timestamp                                                 |

### Session Model

| Credential    | Format                                 | Lifetime                     | Where it lives                                                                                                                                                                 |
| :------------ | :------------------------------------- | :--------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Access token  | JWT (HS256), claim `sub` = `userId`    | 15 minutes                   | Frontend memory only (never `localStorage`/`sessionStorage`). Sent as `Authorization: Bearer <token>`. Returned in response bodies as `accessToken` with `expiresIn` (seconds) |
| Refresh token | Opaque 256-bit random value, base64url | 7 days, rotated on every use | HTTP-only cookie `refresh_token`. Never returned in a response body                                                                                                            |

Refresh cookie attributes: `HttpOnly`, `SameSite=Lax`, `Path=/api/v1/auth`, `Max-Age=604800`, and `Secure` when `NODE_ENV=production`. The backend CORS configuration must allow credentials (`Access-Control-Allow-Credentials: true`) for `FRONTEND_ORIGIN` and allow the `Authorization` header. The frontend sends auth requests with `credentials: "include"`.

Rotation: `POST /auth/refresh` revokes the presented refresh token, issues a new one (new cookie) and returns a new access token. A revoked, expired or unknown refresh token is rejected with `401 UNAUTHENTICATED` and the cookie is cleared.

## 4. Functional Requirements

### REQ-AUTH-01: Sign Up (Registration Flow)

- Interface renders a two-panel card layout with a sliding emerald-to-dark-green overlay banner:
  - **Left Brand Panel**: Features the FinTrack logo, header text `"Welcome Back!"`, subtext `"Log in to manage your finances."`, and a solid teal action button `"SIGN IN"` that toggles to the login panel.
  - **Right Form Panel**: Titled `"Create Account"`, containing:
    - Google SSO icon button (see REQ-AUTH-03).
    - Divider copy: `"or use your email for registration"`.
    - Input fields with icon adornments:
      - **Name**: Text input with user icon.
      - **Email**: Email input with mail icon.
      - **Password**: Password input with lock icon and trailing eye toggle button (show/hide password).
      - **Confirm Password**: Password input with lock icon and trailing eye toggle button.
    - Primary solid teal submit button labeled `"SIGN UP"`.
- On success: creates the account, starts a session (REQ-AUTH-06) and redirects the user to `/dashboard`. Auth does not create a profile record; the `profile` feature provisions the user's profile with its own defaults on first access.
- Registering with an email that already belongs to any account (including a Google-created one) returns `409 EMAIL_ALREADY_EXISTS`.

### REQ-AUTH-02: Sign In (Login Flow)

- Interface presents the inverted two-panel card layout:
  - **Left Form Panel**: Titled `"Sign in to FinTrack"`, containing:
    - Google SSO icon button (see REQ-AUTH-03).
    - Divider copy: `"or use your account"`.
    - Input fields:
      - **Email**: Email input with mail icon.
      - **Password**: Password input with lock icon and trailing eye toggle button.
    - Action link: `"Forgot your password?"`.
    - Primary solid teal submit button labeled `"SIGN IN"`.
  - **Right Brand Panel**: Features the FinTrack logo, header text `"Hello, Friend!"`, subtext `"Enter your personal details and start journey with us"`, and a solid teal action button `"SIGN UP"` that toggles to the sign-up panel.
- On success: starts a session (REQ-AUTH-06) and navigates the user to `/dashboard`.
- Failure is always `401 INVALID_CREDENTIALS` with no distinction between an unknown email, a wrong password, and a Google-only account that has no password. This prevents account enumeration.

### REQ-AUTH-03: Google Single Sign-On

- Both auth panels show the official `<GoogleLogin type="icon">` button from `@react-oauth/google`. It returns a Google **ID token** (`credential`), which the frontend posts to `POST /auth/google`. The button renders in Google's own multicolor style; this is an accepted deviation from the grey "G" in the visual references.
- The backend verifies the ID token with `google-auth-library` (signature, expiry, audience = `GOOGLE_CLIENT_ID`). A token that fails verification, or whose `email_verified` claim is not `true`, is rejected with `401 INVALID_GOOGLE_TOKEN`.
- Account resolution, in order:
  1. An account with the token's `googleId` exists → sign that user in.
  2. Otherwise an account with the token's email exists → **link**: set `googleId` on that account (keeping `provider` and any `passwordHash`), then sign in.
  3. Otherwise → create a new account (`provider = "google"`, `passwordHash = null`, `name` from the token) and sign in.
- **Conflicting Google identity:** if step 2 finds an account whose `googleId` is already set to a _different_ value than the token's, the existing `googleId` is never overwritten. The request is rejected with `401 INVALID_GOOGLE_TOKEN` and no account is changed. No new error code is introduced.
- **Name resolution for new accounts (step 3):** use the token's `name` claim, trimmed. If it is absent or shorter than 2 characters, use the local part of the email (the text before `@`). If that is also shorter than 2 characters, use `"User"`. This guarantees the `name` minimum in section 5 is always met.
- Frontend states:
  - Popup dismissed or closed by the user: no error, no toast, no state change.
  - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` missing or the Google script fails to load: show the error toast `"Google sign-in is unavailable."`.
  - Backend rejection (`INVALID_GOOGLE_TOKEN`): show the error toast `"Google sign-in failed. Please try again."`.

### REQ-AUTH-04: Password Visibility Toggle

- Trailing eye icon on password and confirmation password fields toggles between obscured (`type="password"`) and plain text (`type="text"`).

### REQ-AUTH-05: Forgot / Reset Password

Password recovery is a two-step flow. No external email service is used (see `rules/tech-stack.md`).

**Step 1: Request.** Clicking `"Forgot your password?"` opens a Radix dialog on the auth card titled `"Reset your password"` with a single email field (mail icon) and a `"SEND RESET LINK"` button. Submitting calls `requestPasswordReset`.

- The backend always responds `200` with the same generic message, `"If an account exists for that email, a reset link has been sent."`, whether or not the email is registered or the account is Google-only (a Google-only account may use this flow to set its first password).
- If the account exists, the backend first invalidates (marks used) every earlier unused `PasswordResetToken` for that user, so at most one reset link is valid per user at any time. It then creates a new `PasswordResetToken` and hands the reset URL `<FRONTEND_ORIGIN>/reset-password?token=<rawToken>` to a `Mailer` port. The only implementation in scope is `ConsoleMailer`, which logs the URL to the server console (development delivery). A production mailer is out of scope.
- On success the dialog replaces the form with the generic message and a `"BACK TO SIGN IN"` button.
- An invalid email format is shown inline in the dialog and does not call the API.

**Step 2: Confirm.** The reset URL opens the frontend route `/reset-password?token=<token>`, a centered card with **New Password** and **Confirm New Password** fields (lock icon, eye toggle, same rules as REQ-AUTH-04 and section 5) and a `"RESET PASSWORD"` button. It calls `resetPassword`.

- On success: the password hash is set (or replaced), the token is marked used, **all** of the user's refresh tokens are revoked, and the user is redirected to `/auth` with the success toast `"Password updated. Please sign in."`. The user is not signed in automatically.
- An unknown, expired or already-used token returns `400 INVALID_RESET_TOKEN`. The page shows `"This reset link is invalid or has expired."` with a link back to `/auth`.
- A missing `token` query parameter shows the same invalid-link state without calling the API.

### REQ-AUTH-06: Session Lifecycle

- **Establish:** `register`, `login` and `googleOAuthLogin` each return `user`, `accessToken` and `expiresIn` in the body and set the `refresh_token` cookie.
- **Restore:** on application load the frontend calls `POST /auth/refresh`. If it succeeds, the returned `accessToken` is kept in memory and the user is treated as signed in. If it returns `401`, the user is unauthenticated.
- **Renew:** the frontend refreshes the access token before it expires, or once after a `401 UNAUTHENTICATED` response from any protected endpoint, and retries the original request once. If the refresh fails, the session is cleared and the user is redirected to `/auth`.
- **Current user:** `GET /auth/me` returns the authenticated user.
- **End:** `logout` revokes the presented refresh token, clears the cookie, and the frontend discards the in-memory access token and clears cached server state. `logout` succeeds (`200`) even when no valid refresh cookie is present.
- **Logout control:** the visuals define no logout control, so auth provides a `logout()` capability plus a minimal `"Sign out"` button on the placeholder `/dashboard` page (REQ-AUTH-07). The `dashboard` feature owns the real app shell and its logout control later.

### REQ-AUTH-07: Protected Route Guard (Frontend)

- The frontend uses a client-side guard in the protected layout (the app is CSR; Next middleware is not used for this).
- While the session-restore call is in flight, protected routes render a loading state, never the protected content and never a flash of `/auth`.
- Unauthenticated access to `/dashboard`, `/transactions`, `/budget`, `/goals`, `/reports` or `/profile` redirects to `/auth`.
- An authenticated user visiting `/auth` is redirected to `/dashboard`.
- **Placeholder pages:** the protected layout and the post-login redirect must be verifiable before other features exist. Auth therefore ships a minimal placeholder page at `/dashboard` (inside the protected layout) showing the signed-in user's name and a `"Sign out"` button. The `dashboard` feature replaces this page; the guard and layout remain owned by auth.
- **Root route:** `/` renders the loading state while the session restores, then redirects to `/dashboard` when authenticated or `/auth` when not. This replaces the existing health-check page at `/`.

### REQ-AUTH-08: Authentication Middleware (Backend Contract for Other Features)

- The auth feature provides a `requireAuth` Express middleware in the Presentation layer. It reads the `Authorization: Bearer` header, verifies the JWT (signature and expiry) and sets the authenticated `userId` on the request for handlers to read.
- Handlers pass `userId` to services as a plain argument; services never receive `req`/`res` (per `rules/architecture.md`).
- A missing, malformed, invalid or expired token yields `401 UNAUTHENTICATED`.
- Every endpoint of every other feature requires `requireAuth`. Those features' contracts declare a `401` response using the shared error shape in section 6, and scope all data by the authenticated `userId`.

## 5. Validation Rules

- `name`: Must be at least 2 characters long.
- `email`: Must be a syntactically valid email string (`name@domain.tld`); normalized to lowercase before use.
- `password`: Must be at least 8 characters long, containing at least one digit and one special character. Applies to sign-up and to the reset-password step. A **special character** is any character that is not an ASCII letter (`A–Z`, `a–z`) or digit (`0–9`); space and underscore count. Sign-in only requires a non-empty password (the strength rule is not applied to existing credentials).
- `confirmPassword`: Must exactly match the value entered in `password`.
- Duplicate registration: Registering with an existing email returns `409 EMAIL_ALREADY_EXISTS`.

### Validation Messages

Field messages are defined once, in the shared schemas in `packages/contracts`, and are used verbatim by the frontend (inline) and returned by the backend in `fieldErrors` (first failing rule per field).

| Field             | Rule violated        | Message                                      |
| :---------------- | :------------------- | :------------------------------------------- |
| `name`            | empty                | `Name is required.`                          |
| `name`            | under 2 characters   | `Name must be at least 2 characters.`        |
| `email`           | empty                | `Email is required.`                         |
| `email`           | invalid format       | `Enter a valid email address.`               |
| `password`        | empty                | `Password is required.`                      |
| `password`        | under 8 characters   | `Password must be at least 8 characters.`    |
| `password`        | no digit             | `Password must include a number.`            |
| `password`        | no special character | `Password must include a special character.` |
| `confirmPassword` | empty                | `Please confirm your password.`              |
| `confirmPassword` | does not match       | `Passwords do not match.`                    |

The same messages apply to the reset-password fields (New Password → `password`, Confirm New Password → `confirmPassword`).

### Generic Failure Feedback

Failures with no domain code above (network errors, `5xx`, unexpected responses) are handled as follows. Domain-coded failures keep the feedback defined in their own requirements.

| Operation                       | Feedback                                                                                  |
| :------------------------------ | :---------------------------------------------------------------------------------------- |
| Sign up                         | Error toast `"Could not create your account. Please try again."`                          |
| Sign in                         | Error toast `"Could not sign in. Please try again."`                                      |
| Google sign-in (backend call)   | Error toast `"Google sign-in failed. Please try again."` (same as `INVALID_GOOGLE_TOKEN`) |
| Request password reset          | Inline dialog error `"Could not send the reset link. Please try again."`                  |
| Reset password (non-`400`)      | Inline form error `"Could not reset your password. Please try again."`                    |
| Session restore (network/`5xx`) | Treated as unauthenticated; no toast                                                      |

## 6. API / Interface Specification

All endpoints are prefixed `/api/v1/auth` and are defined in `packages/contracts`. Shared response shapes:

- `user`: `{ id, name, email }`.
- Error shape: `{ code: string, message: string }`, plus `fieldErrors: Record<string, string>` for validation failures.

### Authentication Endpoints

| API / Operation Name   | Method | Endpoint                       | Auth   | Request Body                                   | Success Status / Response                                      | Description                                                         |
| :--------------------- | :----- | :----------------------------- | :----- | :--------------------------------------------- | :------------------------------------------------------------- | :------------------------------------------------------------------ |
| `register`             | `POST` | `/api/v1/auth/signup`          | Public | `name`, `email`, `password`, `confirmPassword` | `201 Created` (`user`, `accessToken`, `expiresIn`) + cookie    | Registers new user account and creates session                      |
| `login`                | `POST` | `/api/v1/auth/login`           | Public | `email`, `password`                            | `200 OK` (`user`, `accessToken`, `expiresIn`) + cookie         | Authenticates existing user credentials                             |
| `googleOAuthLogin`     | `POST` | `/api/v1/auth/google`          | Public | `token` (Google ID token)                      | `200 OK` (`user`, `accessToken`, `expiresIn`) + cookie         | Authenticates, links, or provisions user via Google SSO             |
| `refreshSession`       | `POST` | `/api/v1/auth/refresh`         | Cookie | None (reads refresh cookie)                    | `200 OK` (`user`, `accessToken`, `expiresIn`) + rotated cookie | Rotates refresh token and issues a new access token                 |
| `getCurrentUser`       | `GET`  | `/api/v1/auth/me`              | Bearer | None                                           | `200 OK` (`user`)                                              | Returns the authenticated user                                      |
| `logout`               | `POST` | `/api/v1/auth/logout`          | Cookie | None (reads refresh cookie)                    | `200 OK` (`success: true`) + cleared cookie                    | Revokes refresh token and clears the cookie                         |
| `requestPasswordReset` | `POST` | `/api/v1/auth/forgot-password` | Public | `email`                                        | `200 OK` (`success: true`, `message`)                          | Issues a reset token and hands the link to the `Mailer` port        |
| `resetPassword`        | `POST` | `/api/v1/auth/reset-password`  | Public | `token`, `password`, `confirmPassword`         | `200 OK` (`success: true`)                                     | Sets a new password, consumes the token, revokes all refresh tokens |

### Error Responses

| Status | `code`                 | When                                                                                                                                 |
| :----- | :--------------------- | :----------------------------------------------------------------------------------------------------------------------------------- |
| `400`  | `VALIDATION_ERROR`     | Request body fails validation (includes `fieldErrors`)                                                                               |
| `400`  | `INVALID_RESET_TOKEN`  | Reset token is unknown, expired or already used                                                                                      |
| `401`  | `INVALID_CREDENTIALS`  | `login` failure (unknown email, wrong password, or account without a password)                                                       |
| `401`  | `INVALID_GOOGLE_TOKEN` | Google ID token fails verification, has an unverified email, or conflicts with the `googleId` already linked to that email's account |
| `401`  | `UNAUTHENTICATED`      | Missing/invalid/expired access token, or missing/invalid/revoked/expired refresh token                                               |
| `409`  | `EMAIL_ALREADY_EXISTS` | `register` with an email that already has an account                                                                                 |

## 7. Acceptance Criteria

- User can switch between Sign In and Sign Up views via the sliding transition panel, and the view is reflected in the `/auth?mode=signin|signup` URL (default `signin`).
- User can register with valid name, email, and matching passwords and is redirected to `/dashboard`.
- Attempting registration with an existing email displays the 409 error toast.
- Form displays inline validation errors when required fields are missing or password requirements are unmet.
- User can toggle password obscuration using the eye icon in both password fields.
- User can sign in with valid email/password credentials and receive a refresh cookie and an in-memory access token.
- Sign-in failure never reveals whether the email exists or whether the account is Google-only.
- User can sign in with Google. A Google sign-in for an existing email account links to it; for an unknown email it creates an account.
- Dismissing the Google popup leaves the page unchanged with no error.
- Reloading the page while signed in restores the session without showing the sign-in screen.
- `requestPasswordReset` returns the same response for registered and unregistered emails, and a registered email produces a reset URL in the server console.
- A valid reset link lets the user set a new password; the link cannot be used a second time or after 30 minutes; and existing sessions are ended.
- Logout revokes the refresh token; a later `refreshSession` with the old cookie returns 401.
- Protected routes redirect unauthenticated users to `/auth`, and `/auth` redirects authenticated users to `/dashboard`.
- Protected API endpoints return `401 UNAUTHENTICATED` without a valid Bearer token.
