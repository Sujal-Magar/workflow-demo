# Frontend Fragment: auth (v1.0.0)

> **SUPERSEDED.** Stale after revisions 1, 2, 3 and 4. Kept as an audit trail only; do not use as synthesis input. The authoritative sources are `../plan.md` and `../contract.md`.

- **Feature:** `auth` (Authentication and Identity)
- **FDS version:** 1.0.0 (`features/auth/fds.md`)
- **Inputs read:** `fds.md`, `behavior.md`, `visuals/auth-signin-page.png`, `visuals/auth-signup-page.png`, `rules/architecture.md`, `rules/conventions.md`, `rules/tech-stack.md`, `features/index.json`, existing `frontend/` tree
- **Scope:** Frontend and Frontend-Testing only. No backend design, no formal API contract. Section 13 lists what the frontend needs from the backend in plain language, for the Synthesizer.

---

## 1. Existing Frontend Baseline

| Item                                                               | Current state                                                                 | Change for `auth`                                                                                                                                                                       |
| :----------------------------------------------------------------- | :---------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/layout.tsx`                                               | Root layout, `globals.css`, no providers, no font loading                     | Add a client `Providers` wrapper (QueryClient, Toast, Google OAuth, Auth session). Load fonts with `next/font/google`, which ships with `next`, so no new library (see Open Question 6) |
| `src/app/page.tsx`                                                 | Health-check page calling `http://localhost:4000/health`                      | **Replaced** by the root redirect page (REQ-AUTH-07 "Root route")                                                                                                                       |
| `src/test/setup.ts`                                                | jest-dom matchers                                                             | Unchanged                                                                                                                                                                               |
| `tailwind.config.ts`                                               | `primary` = blue `#007bff`, `background` = `#f7f8fa`, font var `--font-inter` | Add **new** `brand` tokens (teal, gradient stops) and `shake` keyframes. Do not change the existing `primary` token, which other features may rely on                                   |
| `package.json`                                                     | Has RHF, zod, resolvers, Radix dialog/label, TanStack Query, ts-rest RQ, cva… | Add `@react-oauth/google` (approved, FDS §2). No other additions (see Open Question 8 about `@ts-rest/core`)                                                                            |
| `e2e/smoke.spec.ts`                                                | Expects `h1` "Expense Tracker" on `/`                                         | Will break because `/` now redirects. It must be updated in Test Build Mode (section 14.3)                                                                                              |
| No `src/components`, `src/lib` or `src/features` directories exist | —                                                                             | This fragment sets the layout in section 3. Later features should follow it                                                                                                             |

Constraints from the rules that affect this fragment:

- **No toast library is approved**, and Radix Toast is not on the list. Toasts are built in-house as a small provider and viewport.
- **No icon library is approved.** Icons for user, mail, lock, eye, eye-off, close and spinner are inline SVG components.
- `@testing-library/user-event` is **not** installed or approved. Component tests use `fireEvent` from `@testing-library/react`.
- No MSW. Component tests mock the auth API/hooks module with `vi.mock`.

---

## 2. Routes & Page Structure

| Route                       | File                                     | Guard                              | Purpose                                                                                                                     |
| :-------------------------- | :--------------------------------------- | :--------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| `/`                         | `src/app/page.tsx`                       | Session-aware redirect             | Loading state while the session is restored, then `router.replace('/dashboard')` or `router.replace('/auth')` (REQ-AUTH-07) |
| `/auth?mode=signin\|signup` | `src/app/auth/page.tsx`                  | `GuestOnlyRoute`                   | Sliding Sign In / Sign Up card. `mode` defaults to `signin` when missing or unrecognized (behavior §1)                      |
| `/reset-password?token=<t>` | `src/app/reset-password/page.tsx`        | None (public, see Open Question 7) | Reset-password confirm card (REQ-AUTH-05 Step 2)                                                                            |
| `(protected)` route group   | `src/app/(protected)/layout.tsx`         | `ProtectedRoute`                   | Client-side guard for every protected route (REQ-AUTH-07)                                                                   |
| `/dashboard`                | `src/app/(protected)/dashboard/page.tsx` | inherited                          | **Placeholder**: shows the signed-in user's name and a `"Sign out"` button. The `dashboard` feature replaces it later       |

- `/transactions`, `/budget`, `/goals`, `/reports` and `/profile` are **not** created by auth. The guard covers any page placed under `(protected)/`, so the features that own those routes must put their pages in this group (Open Question 2).
- `/auth` and `/reset-password` read query params with `useSearchParams`. In Next 14 App Router the reading component must sit inside a `<Suspense>` boundary, or `next build` fails. Each page wraps its client content in `<Suspense fallback={<FullPageLoader />}>`.
- Every page and layout listed above is a client component (`"use client"`). The app is CSR (tech-stack).

---

## 3. Directory & File Breakdown

All paths are relative to `frontend/src/`. Files are kebab-case and components are PascalCase (conventions).

```
app/
  layout.tsx                         (modify) fonts + <Providers>
  providers.tsx                      QueryClientProvider, ToastProvider, GoogleAuthProvider, AuthProvider
  page.tsx                           (replace) root redirect
  auth/page.tsx                      <GuestOnlyRoute><AuthCard/></GuestOnlyRoute> inside Suspense
  reset-password/page.tsx            <ResetPasswordCard/> inside Suspense
  (protected)/layout.tsx             <ProtectedRoute>{children}</ProtectedRoute>
  (protected)/dashboard/page.tsx     <DashboardPlaceholder/>

components/ui/                       shared, feature-agnostic primitives
  button.tsx                         cva variants: primary (solid teal), overlay (teal on gradient), link; `isLoading` prop → spinner + disabled + aria-busy
  icon-input.tsx                     <input> with leading icon slot, optional trailing slot, error styling, forwardRef (RHF register)
  password-input.tsx                 IconInput + lock icon + eye toggle (REQ-AUTH-04)
  field-error.tsx                    inline error text (id for aria-describedby)
  form-alert.tsx                     form-level inline error (role="alert")
  full-page-loader.tsx               centered spinner, "Loading…" sr-only text
  toast.tsx                          ToastProvider, useToast(), ToastViewport (in-house)
  icons.tsx                          UserIcon, MailIcon, LockIcon, EyeIcon, EyeOffIcon, CloseIcon, SpinnerIcon (inline SVG)

lib/
  cn.ts                              clsx + tailwind-merge
  api-client.ts                      ts-rest React Query client with custom fetcher (section 5.3)
  env.ts                             reads NEXT_PUBLIC_API_BASE_URL, NEXT_PUBLIC_GOOGLE_CLIENT_ID

features/auth/
  components/
    auth-card.tsx                    sliding two-panel container; reads/writes `mode`
    sign-in-form.tsx
    sign-up-form.tsx
    brand-panel.tsx                  logo + heading + subtext + toggle button (both variants)
    fintrack-logo.tsx                wordmark (Open Question 5)
    google-sign-in-button.tsx        <GoogleLogin type="icon"> or unavailable fallback
    forgot-password-dialog.tsx       Radix Dialog, request step + success step
    reset-password-card.tsx          token check → form | invalid-link state
    reset-password-form.tsx
    invalid-reset-link.tsx
    dashboard-placeholder.tsx        user name + SignOutButton
    sign-out-button.tsx
  session/
    access-token-store.ts            module-scoped in-memory token holder (never Web Storage)
    auth-provider.tsx                AuthContext: status, user, establishSession, clearSession, logout
    session-refresh.ts               single-flight refreshSession() + renewal timer scheduling
    use-auth.ts                      context consumer hook
  guards/
    protected-route.tsx
    guest-only-route.tsx
  hooks/
    use-auth-mode.ts                 parse/normalize ?mode, switchMode() via router.push
    use-sign-in.ts                   mutation wrapper → establishSession → /dashboard
    use-sign-up.ts
    use-google-sign-in.ts
    use-request-password-reset.ts
    use-reset-password.ts
    use-current-user.ts              query for the placeholder dashboard (section 5.5)
  lib/
    auth-copy.ts                     every user-facing auth string as named constants (section 8)
    auth-error.ts                    maps API error `code` → UI outcome (discriminated union)
    apply-field-errors.ts            server fieldErrors → RHF setError
  mocks/                             Phase 5 only; deleted in Integration (section 12)
    auth-mock-api.ts
    auth-mock-data.ts
    auth-form-schemas.mock.ts        temporary schemas mirroring FDS §5 until contracts land
```

---

## 4. Component Breakdown

### 4.1 `AuthCard` (REQ-AUTH-01, REQ-AUTH-02, behavior §1–2)

- **Layout** (from the visuals): a centered card about 1110 px wide and 830 px tall, with a large radius (`rounded-3xl`), a soft shadow, a white background, on the `#f7f8fa` page background. The split is **60% form / 40% overlay**:
  - `mode=signin`: SignInForm on the left (60%), overlay BrandPanel on the right (40%) with "Hello, Friend!" and **SIGN UP**.
  - `mode=signup`: overlay BrandPanel on the left (40%) with "Welcome Back!" and **SIGN IN**, SignUpForm on the right (60%).
- **Sliding mechanics:** both forms stay mounted and are absolutely positioned. The overlay moves with `translate-x` over about 600 ms `ease-in-out`, and the form layers cross-fade and translate. Use `motion-safe:` so `prefers-reduced-motion` switches instantly.
- **Hidden view:** the form that is not active gets `aria-hidden="true"` and `inert`, so it is not focusable or tabbable. React 18 has no typed `inert` prop, so set it through a ref or with `{...{ inert: '' }}`.
- **Mode switching:** the overlay button calls `switchMode(next)`, which runs `router.push('/auth?mode=<next>', { scroll: false })`. `push` is used rather than `replace` so the browser Back button works (behavior §1).
- **Clearing the hidden view** (behavior §2): an effect keyed on `mode` calls each form's `reset()` (values and errors) and clears form-level alerts and shake state. The form's reset is triggered by the mode change, not by the button click, so Back/Forward navigation also clears the hidden view.
- **Small screens:** not covered by the visuals. See Open Question 4. Proposed default: below `md`, stack the BrandPanel above the active form with no slide, and show only the active form.

### 4.2 `BrandPanel`

- Props: `variant: 'signin-invite' | 'signup-invite'`, `onToggle`.
- Background: a diagonal gradient from emerald (about `#4ACFAC`, top-left) to dark green (about `#1B5E52`, bottom-right).
- Content: `FinTrackLogo` near the top. Vertically centered below it, a white bold heading, white subtext and a solid teal overlay button.
  - Sign-in view: "Hello, Friend!" / "Enter your personal details and start journey with us" / **SIGN UP**
  - Sign-up view: "Welcome Back!" / "Log in to manage your finances." / **SIGN IN**

### 4.3 `SignInForm` (REQ-AUTH-02, behavior §4)

- Title: "Sign in to FinTrack". Below it, `GoogleSignInButton`, then the divider "or use your account".
- Fields: Email (`IconInput`, mail icon, `type="email"`, `autoComplete="email"`) and Password (`PasswordInput`, `autoComplete="current-password"`).
- A "Forgot your password?" link-style button that acts as the Radix `Dialog.Trigger` for `ForgotPasswordDialog`. Using the trigger gives focus return for free.
- **SIGN IN** submit button (`Button variant="primary" isLoading={isPending}`).
- RHF + `zodResolver(signInSchema)`. Mode `onSubmit`, then `reValidateMode: 'onChange'`. The email must be present and valid. The password must be **non-empty only** (no strength rule, FDS §5).
- Outcomes:
  - `INVALID_CREDENTIALS`: `FormAlert` "Invalid email or password". Both credential inputs play the `shake` animation, re-triggered on every failure with an incrementing `key` or attempt counter. Field values stay as entered. The alert clears on the next submit.
  - `VALIDATION_ERROR`: server `fieldErrors` go to `setError`, shown inline.
  - Network, 5xx or unexpected: toast "Could not sign in. Please try again."
  - Success: `establishSession(session)`, then `router.replace('/dashboard')`.
- While a Google sign-in is pending, the form's submit button is also disabled. This prevents two concurrent session establishments.

### 4.4 `SignUpForm` (REQ-AUTH-01, behavior §3)

- Title: "Create Account". Below it, `GoogleSignInButton`, then the divider "or use your email for registration".
- Fields: Name (user icon, `autoComplete="name"`), Email (mail icon), Password (`PasswordInput`, `autoComplete="new-password"`), Confirm Password (`PasswordInput`, `autoComplete="new-password"`). Each eye toggle is independent.
- **SIGN UP** submit button with a loading state.
- RHF + `zodResolver(signUpSchema)`, which includes the `confirmPassword` match refinement on path `confirmPassword`.
- Outcomes:
  - `EMAIL_ALREADY_EXISTS`: toast "An account with this email already exists."
  - `VALIDATION_ERROR`: server `fieldErrors` shown inline.
  - Network, 5xx or unexpected: toast "Could not create your account. Please try again."
  - Success: `establishSession`, then `router.replace('/dashboard')`.

### 4.5 `PasswordInput` (REQ-AUTH-04)

- An `IconInput` with a leading lock icon and a trailing `<button type="button">` eye toggle.
- Local `isVisible` state switches `type` between `password` and `text`. The icon switches between Eye and EyeOff.
- `aria-label` switches between "Show password" and "Hide password", with `aria-pressed={isVisible}` and `aria-controls` pointing at the input id.
- The toggle does not submit the form and does not steal focus from the input more than one click would.

### 4.6 `GoogleSignInButton` (REQ-AUTH-03, behavior §5)

- `GoogleAuthProvider` (in `providers.tsx`) renders `<GoogleOAuthProvider clientId onScriptLoadError>` only when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set. It exposes `isGoogleAvailable` through a small context. The value is false when the ID is missing or `onScriptLoadError` fired.
- If available, render `<GoogleLogin type="icon" shape="circle" onSuccess onError />`. Google's multicolor style is an accepted deviation from the visuals (FDS REQ-AUTH-03).
  - `onSuccess({ credential })`: `googleSignIn.mutate({ token: credential })`. If `credential` is missing, treat it like `onError`.
  - `onError`: **no-op**. No toast, no state change. The library cannot tell a user dismissal apart from other popup outcomes, and the spec requires silence on dismissal.
- If unavailable, render a same-size circular fallback icon button with a grey "G" SVG and `aria-label="Sign in with Google"`. Clicking it shows the error toast "Google sign-in is unavailable." (Open Question 1).
- Backend outcomes:
  - `INVALID_GOOGLE_TOKEN`, network, 5xx or unexpected: toast "Google sign-in failed. Please try again."
  - Success: `establishSession`, then `router.replace('/dashboard')`.
- While the Google mutation is pending, show a spinner overlay on the button and disable the surrounding form's submit button.

### 4.7 `ForgotPasswordDialog` (REQ-AUTH-05 Step 1, behavior §6)

- Radix `Dialog.Root` controlled with `open` state. `Dialog.Portal` with an overlay over the auth card. `Dialog.Title` "Reset your password". `Dialog.Description` is sr-only and explains the purpose. `Dialog.Close` is an icon button with `aria-label="Close"`.
- It closes on Escape, on an outside click, and through the close control. Focus returns to the "Forgot your password?" trigger (Radix default when `Dialog.Trigger` is used).
- **Request step:** Email field (mail icon) and a **SEND RESET LINK** button. RHF + `forgotPasswordSchema`, so an invalid or empty email is flagged inline and no request is sent.
  - Pending: the button is disabled and shows a spinner.
  - Success: swap the form for the generic message returned by the backend. Fall back to the constant "If an account exists for that email, a reset link has been sent." if the body has no message. Show a **BACK TO SIGN IN** button that closes the dialog.
  - Failure (network, 5xx or unexpected): inline `FormAlert` "Could not send the reset link. Please try again." The form stays open with its value kept.
- Every time the dialog opens, it resets to the request step with an empty field and no errors.

### 4.8 `ResetPasswordCard` / `ResetPasswordForm` / `InvalidResetLink` (REQ-AUTH-05 Step 2, behavior §6)

- A centered white card in the same visual language as the auth card (single panel), with `FinTrackLogo`.
- A missing or empty `token` query param renders `InvalidResetLink` right away with **no API call**.
- `InvalidResetLink` shows "This reset link is invalid or has expired." and a link to `/auth`.
- `ResetPasswordForm`: New Password and Confirm New Password fields (each a `PasswordInput` with its own eye toggle) and a **RESET PASSWORD** button. It uses RHF + `resetPasswordFormSchema`, which applies the sign-up password rules plus the confirm match, and the same messages as FDS §5.
  - Pending: the button is disabled and loading.
  - Success: `toast.success("Password updated. Please sign in.")`, then `router.replace('/auth?mode=signin')`. The toast survives because `ToastProvider` lives in the root layout. The user is **not** signed in.
  - `INVALID_RESET_TOKEN`: replace the form with `InvalidResetLink`.
  - `VALIDATION_ERROR`: field errors shown inline. `password` maps to New Password and `confirmPassword` to Confirm New Password.
  - Any other failure: inline `FormAlert` "Could not reset your password. Please try again."

### 4.9 Guards (REQ-AUTH-07, behavior §8)

- `ProtectedRoute`:
  - `status === 'loading'`: `<FullPageLoader/>`. It never renders children and never redirects.
  - `status === 'unauthenticated'`: `router.replace('/auth')` and render the loader until navigation completes.
  - `status === 'authenticated'`: render children.
- `GuestOnlyRoute` (for `/auth`):
  - `loading`: loader, which prevents a flash of the form for a signed-in user.
  - `authenticated`: `router.replace('/dashboard')`.
  - `unauthenticated`: render children.
- The root page uses the same three-state logic and redirects to `/dashboard` or `/auth`.

### 4.10 `DashboardPlaceholder` + `SignOutButton` (REQ-AUTH-06 "Logout control", REQ-AUTH-07 "Placeholder pages")

- Shows "Signed in as {user.name}". The name comes from `useCurrentUser()`, with the session user as `initialData` (section 5.5). Below it, a **Sign out** button.
- `SignOutButton` calls `logout()` (section 5.4). While it is pending the button is disabled.

### 4.11 Toast system (`components/ui/toast.tsx`)

- `ToastProvider` holds a queue in React state. `useToast()` returns `{ success(message), error(message) }`.
- `ToastViewport` is fixed top-right. Each toast has a variant (success is teal/green, error is red), a close button, and auto-dismisses after about 5 s.
- Region semantics: error toasts use `role="alert"` and success toasts use `role="status"`, inside an `aria-live` region.
- Identical messages fired back-to-back (for example a double submit) are de-duplicated while the first is still visible.

---

## 5. Session & API Client Layer (REQ-AUTH-06, FDS §3 Session Model, behavior §7)

### 5.1 In-memory access token

- `access-token-store.ts` is a module-scoped holder: `{ accessToken, expiresAt }` with `getAccessToken()`, `setAccessToken(token, expiresInSeconds)` and `clearAccessToken()`.
- It is **never** written to `localStorage`, `sessionStorage`, cookies or IndexedDB. Component tests assert this (section 14.1).
- The store is module-scoped, not React state, so the ts-rest fetcher can read it outside React.

### 5.2 `AuthProvider`

- Context value:
  - `status: 'loading' | 'authenticated' | 'unauthenticated'`
  - `user: AuthUser | null`
  - `establishSession(session)`
  - `clearSession()`
  - `logout()`
- **Restore** (on mount): call `refreshSession()` through the single-flight helper.
  - Success: `establishSession`.
  - 401, network error or 5xx: `unauthenticated`, with **no toast** (FDS §5 Generic Failure Feedback).
- **Single-flight refresh:** `session-refresh.ts` keeps one in-flight promise, and any concurrent caller awaits that same promise. This matters because refresh tokens **rotate on every use**. React StrictMode runs effects twice in development, and the renewal timer and a 401 retry can collide. A duplicate refresh would present an already-revoked cookie, get a 401, and log the user out by mistake.
- **Establish:** set the token store, set `user`, set `status = 'authenticated'`, and schedule renewal.
- **Renew:** a timer fires at `expiresIn - RENEWAL_LEAD_SECONDS` (proposed 60 s, never less than 0; Open Question 9) and calls `refreshSession()`.
  - Success: re-establish the session.
  - Failure: `clearSession()` and `router.replace('/auth')`.
- **clearSession:** clear the token store, cancel the timer, run `queryClient.clear()` (clears cached server state), set `user = null` and `status = 'unauthenticated'`.

### 5.3 ts-rest client with custom fetcher (`lib/api-client.ts`)

- The client is built from the auth contract exported by `@workflow-demo/contracts`, using `@ts-rest/react-query`.
- Base URL is `NEXT_PUBLIC_API_BASE_URL` (Open Question 3). The existing code hardcodes `http://localhost:4000`.
- A custom `api` fetcher, built on global `fetch`, does the following on **every** request:
  - Sends `credentials: 'include'` (FDS §3).
  - Adds `Authorization: Bearer <token>` when a token is in memory.
  - **401 retry:** if the response is `401` with `code === 'UNAUTHENTICATED'` **and** the request was a protected (Bearer) request, it runs the single-flight `refreshSession()` once and retries the original request once with the new token.
    - If the refresh fails, it calls `clearSession()` and redirects to `/auth`.
    - If the retry also returns 401, it returns that response and clears the session the same way.
  - The retry is **excluded** for public and cookie auth operations: sign-up, login, google, refresh, logout, forgot-password and reset-password. A `401 INVALID_CREDENTIALS` or `INVALID_GOOGLE_TOKEN` must reach the form untouched, and a failing refresh must not recurse.
- Calls made outside React, such as restore, renewal and logout, use the client's non-hook call methods, so every request still goes through the contract.

### 5.4 Logout (REQ-AUTH-06 "End", behavior §7)

- `logout()` calls the backend logout operation. **Whatever the outcome** (success, failure or network error), it then runs `clearSession()` and `router.replace('/auth')`.

### 5.5 `useCurrentUser` (placeholder dashboard)

- A query on the "current user" read with `initialData` taken from the session user.
- It gives the placeholder page one real Bearer-protected request, so the Bearer header and the 401-refresh-retry path can be tested end to end before other features exist. The auth screens themselves never need it, because every session-establishing response already carries `user`.

---

## 6. Forms & Validation UX

- **Schema source:** in the final state (after Integration), every form schema and every field message comes from the **shared schemas in `packages/contracts`** (FDS §5 "Validation Messages"). The frontend never redefines them.
- **During Phase 5** the contracts are being built in parallel and cannot be imported. Temporary copies live in `features/auth/mocks/auth-form-schemas.mock.ts`, with the exact FDS §5 messages, and are deleted at Integration.
- **First failing rule per field:** RHF's default `criteriaMode: 'firstError'` together with `zodResolver` shows the first Zod issue per path. The shared schemas therefore need their rules ordered as the FDS table lists them. For example, an empty email must yield "Email is required." and not "Enter a valid email address." (section 13, item X1).
- **Form schemas the frontend needs:**
  - `signUpSchema`: name, email, password (strength), confirmPassword (required + match).
  - `signInSchema`: email (required + format), password (required only).
  - `forgotPasswordSchema`: email.
  - `resetPasswordFormSchema`: password (strength), confirmPassword (required + match). The token is **not** a form field; it comes from the URL and is merged into the request.
- **Timing:** validate on submit first, then re-validate on change after the first submit. Invalid submits never call the API (behavior §3, §4, §6).
- **Server field errors:** `apply-field-errors.ts` maps a `fieldErrors` record onto `setError(field, { type: 'server', message })`, ignoring unknown keys.
- **Error presentation:**
  - Invalid inputs get `aria-invalid="true"`, a red border and `aria-describedby` pointing at the `FieldError` id.
  - Focus moves to the first invalid field on a failed submit (RHF `shouldFocusError`, default true).
- **Email value:** sent as entered, trimmed. Lowercase normalization is the backend's job (FDS §5).

---

## 7. State Matrix

| Screen / element                   | Loading                                              | Success                           | Error                                                                                       | Empty                             |
| :--------------------------------- | :--------------------------------------------------- | :-------------------------------- | :------------------------------------------------------------------------------------------ | :-------------------------------- |
| App load (`/`, protected, `/auth`) | `FullPageLoader` while restore is pending            | Redirect or render per guard      | Restore failure means unauthenticated, silently                                             | —                                 |
| Sign in                            | Submit disabled + spinner                            | `/dashboard`                      | Inline "Invalid email or password" + shake, or toast "Could not sign in. Please try again." | Inline required errors            |
| Sign up                            | Submit disabled + spinner                            | `/dashboard`                      | Toast for 409 or generic; inline field errors for server validation                         | Inline required errors            |
| Google                             | Spinner on button, form submit disabled              | `/dashboard`                      | Toast "Google sign-in failed…" or "Google sign-in is unavailable."                          | Dismissal: nothing                |
| Forgot dialog                      | SEND RESET LINK disabled + spinner                   | Generic message + BACK TO SIGN IN | Inline "Could not send the reset link. Please try again."                                   | Inline required error             |
| Reset page                         | RESET PASSWORD disabled + spinner                    | Toast + `/auth?mode=signin`       | Invalid-link state (400 token), or inline "Could not reset your password…"                  | Missing token: invalid-link state |
| Dashboard placeholder              | Name from session is shown immediately (initialData) | Name + Sign out                   | Protected 401: refresh + retry, or on failure redirect to `/auth`                           | —                                 |
| Sign out                           | Button disabled                                      | `/auth`                           | Local session is still cleared and the user is still sent to `/auth`                        | —                                 |

---

## 8. User-Facing Copy Catalog (`features/auth/lib/auth-copy.ts`)

Field validation messages are **not** in this file. They come from the contracts package (FDS §5).

| Constant key                       | Text                                                                         | Source                           |
| :--------------------------------- | :--------------------------------------------------------------------------- | :------------------------------- |
| `SIGN_IN_TITLE`                    | Sign in to FinTrack                                                          | REQ-AUTH-02                      |
| `SIGN_IN_DIVIDER`                  | or use your account                                                          | REQ-AUTH-02                      |
| `SIGN_UP_TITLE`                    | Create Account                                                               | REQ-AUTH-01                      |
| `SIGN_UP_DIVIDER`                  | or use your email for registration                                           | REQ-AUTH-01                      |
| `SIGN_IN_INVITE_HEADING` / `_TEXT` | Hello, Friend! / Enter your personal details and start journey with us       | REQ-AUTH-02                      |
| `SIGN_UP_INVITE_HEADING` / `_TEXT` | Welcome Back! / Log in to manage your finances.                              | REQ-AUTH-01                      |
| Buttons                            | SIGN IN, SIGN UP, SEND RESET LINK, BACK TO SIGN IN, RESET PASSWORD, Sign out | REQ-AUTH-01/02/05/06             |
| `FORGOT_PASSWORD_LINK`             | Forgot your password?                                                        | REQ-AUTH-02                      |
| `RESET_DIALOG_TITLE`               | Reset your password                                                          | REQ-AUTH-05                      |
| `RESET_REQUEST_SENT`               | If an account exists for that email, a reset link has been sent.             | REQ-AUTH-05 (fallback text only) |
| `INVALID_CREDENTIALS`              | Invalid email or password                                                    | behavior §4                      |
| `EMAIL_EXISTS_TOAST`               | An account with this email already exists.                                   | behavior §3                      |
| `SIGN_UP_FAILED_TOAST`             | Could not create your account. Please try again.                             | FDS §5 / behavior §3             |
| `SIGN_IN_FAILED_TOAST`             | Could not sign in. Please try again.                                         | FDS §5                           |
| `GOOGLE_UNAVAILABLE_TOAST`         | Google sign-in is unavailable.                                               | REQ-AUTH-03                      |
| `GOOGLE_FAILED_TOAST`              | Google sign-in failed. Please try again.                                     | REQ-AUTH-03 / FDS §5             |
| `RESET_REQUEST_FAILED`             | Could not send the reset link. Please try again.                             | FDS §5 / behavior §6             |
| `RESET_FAILED`                     | Could not reset your password. Please try again.                             | FDS §5                           |
| `RESET_LINK_INVALID`               | This reset link is invalid or has expired.                                   | REQ-AUTH-05                      |
| `PASSWORD_UPDATED_TOAST`           | Password updated. Please sign in.                                            | REQ-AUTH-05                      |
| Placeholders                       | Name, Email, Password, Confirm Password, New Password, Confirm New Password  | visuals / REQ-AUTH-05            |

---

## 9. Visual & Styling Notes (Phase 6 UI Review checks against the visuals)

- **New Tailwind tokens** (additive only):
  - `brand.teal` about `#00B894`, used for solid buttons (with a darker hover and focus ring)
  - `brand.gradientFrom` about `#4ACFAC` and `brand.gradientTo` about `#1B5E52`
  - `brand.ink` about `#2D2D2D`, used for form titles
  - A `shake` keyframe of about 400 ms (horizontal ±6 px)
- **Card:** about 1110 × 830 px at desktop. `rounded-3xl`, a large soft shadow, white. The overlay panel shares the card's outer radius on its outer corners.
- **Inputs:** about 444 px wide and 48 px tall, with a 1 px grey border (`#D1D5DB`), a small radius, and a 20 px grey leading icon. The eye toggle sits on the right. Placeholder text is grey. Fields are about 28 px apart.
- **Buttons:** about 160 × 40 px, uppercase, medium weight, white text on solid teal, small radius. The same style is used on the form and on the gradient overlay.
- **Typography:**
  - Form titles are bold and geometric (Poppins-like), about 36 px.
  - Overlay headings are bold white sans (Inter), about 40 px.
  - Divider text and subtext are small and grey. Overlay subtext is white.
- **Logo:** the FinTrack wordmark with an upward arrow and the tagline "Track smarter. Save better." (visible in the visuals). See Open Question 5.
- **Google button:** Google's own multicolor rendering (accepted deviation).

---

## 10. Accessibility

- Every input has a real `<label>` (Radix `Label`), visually hidden (`sr-only`) because the visuals show placeholder-only fields.
- The eye toggle has an `aria-label` and `aria-pressed`. Loading buttons have `aria-busy` and `aria-disabled`.
- The hidden sliding view is `inert` and `aria-hidden`. The card's active form heading is an `h1`.
- Dialog: Radix gives the focus trap, Escape handling, `aria-labelledby` (Title) and focus return.
- The toast region is `aria-live`. Error toasts use `role="alert"`.
- `motion-safe:` is used for slide and shake animations.
- The keyboard order in each view is: Google, then the fields, then Forgot link (sign-in), then submit, then the overlay toggle.

---

## 11. Frontend Data Shapes (built against during Phase 5)

These mirror FDS §3 and §6. After Integration they are replaced by types inferred from the contracts package.

```ts
type AuthUser = { readonly id: string; readonly name: string; readonly email: string };

type AuthSession = { readonly user: AuthUser; readonly accessToken: string; readonly expiresIn: number }; // seconds

type ApiErrorBody = {
  readonly code: string; // e.g. VALIDATION_ERROR | INVALID_CREDENTIALS | INVALID_GOOGLE_TOKEN | UNAUTHENTICATED | EMAIL_ALREADY_EXISTS | INVALID_RESET_TOKEN
  readonly message: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
};

type SessionStatus = "loading" | "authenticated" | "unauthenticated";

type SignUpInput = { name: string; email: string; password: string; confirmPassword: string };
type SignInInput = { email: string; password: string };
type GoogleSignInInput = { token: string };
type ForgotPasswordInput = { email: string };
type ResetPasswordInput = { token: string; password: string; confirmPassword: string };

// UI-side outcome mapping (auth-error.ts), a discriminated union consumed by forms
type AuthFailure =
  | { kind: "fieldErrors"; fieldErrors: Record<string, string> }
  | { kind: "invalidCredentials" }
  | { kind: "emailExists" }
  | { kind: "invalidGoogleToken" }
  | { kind: "invalidResetToken" }
  | { kind: "unauthenticated" }
  | { kind: "unexpected" }; // network, 5xx, unknown code
```

---

## 12. Phase 5 Mock Layer (removed in Integration)

- The hooks in `features/auth/hooks/*` and `session/session-refresh.ts` call one internal auth API module. In Phase 5 that module is backed by `mocks/auth-mock-api.ts`. Integration swaps it for `lib/api-client.ts` calls without changing hook signatures or components.
- The mock state is held in **module memory only** (no Web Storage). Each call has about 400 ms latency so loading states are visible.
- **Mock data:**
  - Existing user: `{ id: '8d0f…-uuid', name: 'Piyush Kumar', email: 'piyush@example.com' }`, password `Passw0rd!`.
  - Google-only user: `{ name: 'Gia Google', email: 'gia@example.com' }`, with no password, so login gives `invalidCredentials`.
  - Registering `taken@example.com` or `piyush@example.com` gives `EMAIL_ALREADY_EXISTS`.
  - Any email containing `fail@` gives a simulated network error, to exercise the generic-failure copy.
  - Reset token `valid-token` succeeds. Any other token gives `INVALID_RESET_TOKEN`.
  - Google: any credential succeeds, except the literal `bad-credential`, which gives `INVALID_GOOGLE_TOKEN`.
  - Refresh: returns 401 until a mock sign-in or sign-up has happened in this JS session, then returns a new fake token with `expiresIn: 900`.
  - Current user: returns the mock session user.
  - Logout: always succeeds.
- `auth-form-schemas.mock.ts` holds temporary copies of the FDS §5 rules and messages, deleted at Integration in favor of the contracts package.

---

## 13. What the Frontend Needs from the Backend (plain language, for the Synthesizer)

**B1. Create an account (Sign Up screen)**

- Writes: name, email, password, confirmPassword.
- Reads back on success: the user (id, name, email), a short-lived access token, and that token's lifetime in seconds. The long-lived session credential is set as an HTTP-only cookie the frontend never reads.
- The frontend must be able to tell apart:
  - success
  - "email already has an account"
  - field validation failure, with one message per field
  - anything else

**B2. Sign in with email/password (Sign In screen)**

- Writes: email, password.
- Reads back on success: the same payload as B1.
- The frontend must be able to tell apart:
  - success
  - a single undifferentiated "invalid credentials" outcome
  - field validation failure
  - anything else
- An "invalid credentials" failure must **not** trigger the frontend's session-refresh retry, so it must be distinguishable from an "unauthenticated / session expired" failure.

**B3. Sign in with Google (both panels)**

- Writes: the Google ID token string (`credential` from `@react-oauth/google`).
- Reads back on success: the same payload as B1.
- The frontend must be able to tell apart:
  - success (new account, existing Google account, or linked email account; the frontend treats all three the same)
  - "Google token rejected"
  - anything else

**B4. Restore / renew the session (app load, renewal timer, 401 retry)**

- Writes: nothing. It relies only on the cookie.
- Reads back: the user, a new access token and its lifetime. The cookie is rotated.
- Outcomes: success, or unauthenticated.
- It must work as a credentialed cross-origin request from the frontend origin (`http://localhost:3000` → `http://localhost:4000` in dev).

**B5. Read the current user (placeholder dashboard, protected-request path)**

- Writes: nothing. Authenticated with `Authorization: Bearer`.
- Reads back: the user (id, name, email).
- An expired or invalid access token must produce the distinguishable "unauthenticated" outcome, which triggers refresh + retry.

**B6. Sign out**

- Writes: nothing. It relies on the cookie.
- Must succeed even with no valid cookie. It ends the server-side session and clears the cookie.

**B7. Request a password reset (Forgot dialog)**

- Writes: email.
- Reads back: a success flag and the generic message text, which is the same for every email.
- Outcomes: success, field validation failure, or anything else.

**B8. Reset the password (reset page)**

- Writes: the token from the URL, password, confirmPassword.
- Reads back: a success flag.
- The frontend must be able to tell apart:
  - success
  - "reset link invalid / expired / used"
  - field validation failure
  - anything else

**Cross-cutting needs**

- **X1. Shared validation schemas and messages.** Sign-up, sign-in, forgot-password and reset-password (form-field subset) schemas must be exported from the contracts package with the exact FDS §5 messages. The first failing rule per field must be the first reported issue. The reset form schema must be usable without the `token` field, or be composable from a password + confirm sub-schema.
- **X2. Uniform error body.** A machine-readable `code`, a human `message`, and an optional per-field messages map keyed by form field name (`name`, `email`, `password`, `confirmPassword`) so they map straight onto form fields.
- **X3. Declared statuses.** Every operation's possible error statuses are declared in the contract, so the typed client can branch on status and `code` without `any`.
- **X4. CORS.** Credentials are allowed for the frontend origin, and the `Authorization` request header is allowed. The cookie path must cover the refresh and logout operations.
- **X5. Base URL.** The frontend reads the API origin from a public env var (Open Question 3). The API is served under `/api/v1/auth/...` per FDS §6.
- **X6. E2E reset-token access.** A supported way for Playwright to obtain a raw reset token for a registered email in the E2E environment (Open Question 10), or explicit agreement that the valid-token path is covered below E2E.

---

## 14. Frontend Testing

### 14.1 Component / unit tests (Vitest + RTL + jsdom, `fireEvent`, `vi.mock` for the API module, `next/navigation`, `@react-oauth/google`)

**AuthCard / mode** (behavior §1–2, FDS §7 AC1)

- A missing or unrecognized `mode` renders Sign In. `mode=signup` renders Sign Up.
- Clicking overlay **SIGN UP** or **SIGN IN** calls `router.push('/auth?mode=…')`.
- Changing `mode` clears the hidden view's values and inline errors.
- The hidden view is `aria-hidden` and `inert`.
- The overlay shows the correct heading, text and button per mode.

**SignUpForm** (REQ-AUTH-01, FDS §5)

- Each validation message in the FDS §5 table appears for its rule, one test per row: empty name, 1-char name, empty email, bad email, empty password, 7 chars, no digit, no special character, empty confirm, mismatch.
- Space and underscore count as special characters.
- No API call when the form is invalid.
- The button is disabled and loading while pending.
- Success calls `establishSession` and `replace('/dashboard')`.
- 409 shows the toast "An account with this email already exists."
- A network error or 500 shows the toast "Could not create your account. Please try again."
- Server `VALIDATION_ERROR` fieldErrors are shown inline.

**SignInForm** (REQ-AUTH-02, behavior §4)

- Empty email, bad email and empty password each give an inline error and no call.
- A weak password such as `a` is accepted client-side (no strength rule).
- Pending state disables the submit button.
- 401 `INVALID_CREDENTIALS` shows the inline "Invalid email or password" and applies the shake class to both inputs.
- Network or 500 shows the toast "Could not sign in. Please try again."
- A 401 `INVALID_CREDENTIALS` does **not** call refresh.
- Success goes to `/dashboard`.

**PasswordInput** (REQ-AUTH-04, AC5)

- The toggle flips `type` between password and text and updates `aria-label` and `aria-pressed`.
- The two fields on the sign-up form toggle independently.
- Clicking the toggle does not submit the form.

**GoogleSignInButton** (REQ-AUTH-03, AC8–9)

- With the client ID missing, the fallback renders and clicking it shows "Google sign-in is unavailable."
- `onScriptLoadError` triggers the same fallback.
- `onError` (dismissal) produces no toast, no navigation and no form change.
- `onSuccess` calls the Google mutation with `{ token: credential }`.
- `INVALID_GOOGLE_TOKEN` shows "Google sign-in failed. Please try again."
- A 500 shows the same toast.
- Success goes to `/dashboard`.

**ForgotPasswordDialog** (REQ-AUTH-05 Step 1, behavior §6)

- Opens from the link with the title "Reset your password".
- An invalid or empty email gives an inline error and no call.
- Pending state disables the button.
- Success shows the generic message and **BACK TO SIGN IN**, which closes the dialog.
- Failure shows the inline "Could not send the reset link. Please try again." and the form stays open.
- Escape closes the dialog and focus returns to the trigger.
- Reopening shows the request step again.

**ResetPasswordCard** (REQ-AUTH-05 Step 2)

- A missing token shows the invalid-link state with a link to `/auth` and makes no call.
- The password rules and match messages appear.
- Success shows the toast "Password updated. Please sign in." and calls `replace('/auth?mode=signin')`, with no `establishSession`.
- `INVALID_RESET_TOKEN` shows the invalid-link state.
- `VALIDATION_ERROR` fieldErrors are shown inline.
- A 500 shows the inline "Could not reset your password. Please try again."

**AuthProvider / session** (REQ-AUTH-06, behavior §7)

- Restore success sets `authenticated` and the token in memory.
- A 401 gives `unauthenticated`.
- A network error or 500 gives `unauthenticated` with no toast.
- Two concurrent `refreshSession()` calls produce **one** request (single-flight).
- The renewal timer fires at `expiresIn - 60s` (fake timers).
- A failed renewal clears the session and redirects to `/auth`.
- Spies on `localStorage` and `sessionStorage` `setItem` are never called with the token.

**API fetcher**

- Every request sends `credentials: 'include'`.
- The Bearer header is attached when a token is present.
- A protected 401 `UNAUTHENTICATED` triggers one refresh and one retry with the new token.
- If the refresh fails, the session is cleared and the user is redirected.
- A second 401 does not loop.
- Auth operations (login, signup, google, refresh, logout, forgot, reset) are never retried.

**Guards & root** (REQ-AUTH-07)

- `ProtectedRoute` shows the loader while `loading` (children not rendered, no redirect).
- `unauthenticated` calls `replace('/auth')`.
- `authenticated` renders the children.
- `GuestOnlyRoute`: `authenticated` calls `replace('/dashboard')`, and `loading` shows the loader rather than the form.
- The root page redirects per status.

**Logout** (REQ-AUTH-06)

- `logout()` calls the API, clears the token, clears the query client and goes to `/auth`.
- If the API rejects, the local session is still cleared and the user is still redirected.

**DashboardPlaceholder**: renders the user name and **Sign out**.

**Toast**: success and error variants, auto-dismiss (fake timers), manual close, and de-duplication.

### 14.2 End-to-end (Playwright, real backend with `DATABASE_PATH=data/e2e-test.db`)

Each test uses a unique email (a timestamp or random suffix) so tests stay independent.

1. **Mode & URL** (AC1)
   - `/auth` shows Sign In.
   - Clicking **SIGN UP** changes the URL to `?mode=signup` without a reload.
   - Browser Back returns to Sign In with the fields cleared.
   - A direct deep link to `?mode=signup` works.
2. **Sign up happy path** (AC2): fill the valid form, land on `/dashboard`, and see the user's name.
3. **Duplicate email** (AC3): register the same email twice and see the toast "An account with this email already exists."
4. **Inline validation** (AC4): submit an empty form, then a weak password, then a mismatch, and see the inline messages. No request is sent (use `page.on('request')` to assert none to `/auth/signup`).
5. **Password toggle** (AC5): each eye toggle flips the input `type`.
6. **Sign in happy path** (AC6)
   - Land on `/dashboard`.
   - `context.cookies()` contains `refresh_token` with `httpOnly: true`.
   - `localStorage` and `sessionStorage` contain no access token.
7. **No enumeration** (AC7): a wrong password for an existing email and an unknown email both show exactly "Invalid email or password".
8. **Session restore** (AC10)
   - While signed in, reload `/dashboard`: it stays on `/dashboard` and the sign-in form never appears.
   - Assert with a navigation listener that no `/auth` URL is visited.
9. **Protected-request renewal**: intercept one current-user request with `page.route` to return `401 UNAUTHENTICATED`, then assert a refresh call happens, the request is retried, and the page stays on `/dashboard`.
10. **Logout** (AC13): **Sign out** goes to `/auth`. A later visit to `/dashboard` redirects to `/auth`, and a reload stays unauthenticated.
11. **Guards** (AC14): signed-out visits to `/dashboard` and `/` go to `/auth`. A signed-in visit to `/auth` goes to `/dashboard`.
12. **Forgot dialog** (AC11, UI side)
    - The same generic message appears for a registered and an unregistered email.
    - Escape closes the dialog and focus returns to the link.
13. **Reset page invalid states**: `/reset-password` with no token, and `/reset-password?token=bogus` after submit, both show "This reset link is invalid or has expired." with a working link to `/auth`.
14. **Reset valid path** (AC12): depends on Open Question 10 / X6.
    - If a token source is agreed: request a reset, obtain the token, set a new password, and check for the toast and `/auth?mode=signin`.
    - Then sign in with the new password (succeeds) and try to reuse the link (invalid state).
    - A second browser context that was signed in before the reset is sent to `/auth` on its next refresh.
15. **Google**
    - Only the presence of the Google control on both panels is asserted. Google's popup and iframe cannot be automated.
    - If the E2E environment runs without `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, clicking the fallback shows "Google sign-in is unavailable."
    - The success, link and create paths are covered by component tests (frontend) and API tests (backend).

### 14.3 Test housekeeping

- `e2e/smoke.spec.ts` must be updated in Test Build Mode, because `/` now redirects to `/auth`. For example, assert the "Sign in to FinTrack" heading after landing.
- The Playwright `webServer` env for the frontend needs `NEXT_PUBLIC_API_BASE_URL`, and needs `NEXT_PUBLIC_GOOGLE_CLIENT_ID` either set or deliberately unset, depending on which Google E2E variant is chosen.
- Coverage: FDS `coverage_target: 95`. Session, fetcher, guards and forms carry most of the logic and must be covered by the component tests above. The mock layer is deleted before Phase 8c.

---

## 15. Spec Traceability

| Requirement / section               | Frontend items                                                                    |
| :---------------------------------- | :-------------------------------------------------------------------------------- |
| REQ-AUTH-01                         | 4.1, 4.2, 4.4, 6, 14.1 SignUpForm, E2E 2–4                                        |
| REQ-AUTH-02                         | 4.1, 4.2, 4.3, 14.1 SignInForm, E2E 6–7                                           |
| REQ-AUTH-03                         | 4.6, providers, 14.1 GoogleSignInButton, E2E 15                                   |
| REQ-AUTH-04                         | 4.5, 14.1 PasswordInput, E2E 5                                                    |
| REQ-AUTH-05                         | 4.7, 4.8, 14.1 ForgotPasswordDialog / ResetPasswordCard, E2E 12–14                |
| REQ-AUTH-06                         | 5.1–5.5, 4.10, 14.1 AuthProvider / fetcher / Logout, E2E 8–10                     |
| REQ-AUTH-07                         | 2, 4.9, 4.10, 14.1 Guards, E2E 8, 11                                              |
| REQ-AUTH-08                         | Frontend side only: Bearer header + 401 handling (5.3). The middleware is backend |
| FDS §3 Session Model                | 5.1–5.3                                                                           |
| FDS §5 Validation / Generic Failure | 6, 7, 8, 14.1                                                                     |
| FDS §7 Acceptance Criteria          | 14.2 (AC numbers inline)                                                          |
| behavior §1–8                       | 2, 4.1–4.10, 5, 14                                                                |

---

## 16. Open Questions for the Synthesizer

None of these block the fragment. Each has a recommended default that stays within the spec.

1. **When to show "Google sign-in is unavailable."** Behavior §5 step 2 places it under "User clicks it". **Default:** when Google is unavailable, render a fallback icon button and show the toast on click, not on page load.
2. **Other protected routes.** Auth ships only the `/dashboard` placeholder (REQ-AUTH-07). **Default:** the guard lives in the `(protected)` route-group layout. Features owning `/transactions`, `/budget`, `/goals`, `/reports` and `/profile` must put their pages under `(protected)/`. E2E for those redirects is added when those pages exist.
3. **API base URL env var.** It is not named in the FDS. **Default:** `NEXT_PUBLIC_API_BASE_URL`, falling back to `http://localhost:4000` in development.
4. **Small-screen layout.** Not in the visuals; rules require a responsive design. **Default:** below `md`, stack the BrandPanel above the active form with no slide, and keep all copy unchanged.
5. **Logo asset.** No logo file is supplied, only screenshots. **Default:** an inline SVG/text wordmark "FinTrack" with an arrow glyph and the tagline "Track smarter. Save better.", confirmed at Phase 6 UI Review.
6. **Fonts.** The Tailwind config references `--font-inter`, but nothing loads it. **Default:** load Inter (body) and Poppins (form titles) through `next/font/google`, which ships with `next`, so no new dependency.
7. **Signed-in user opening `/reset-password`.** Not specified. **Default:** no guard, and the page works either way. A successful reset still redirects to `/auth?mode=signin`, where `GuestOnlyRoute` sends a still-authenticated tab to `/dashboard` until its refresh fails.
8. **`@ts-rest/core` as a direct frontend dependency.** It is already in the approved stack under API Contracts. It is needed only if the custom fetcher's types (`ApiFetcherArgs`) are not re-exported by `@ts-rest/react-query`. **Default:** add it only if needed. `@react-oauth/google` must be added (approved).
9. **Renewal lead time.** "Shortly before it expires" is not quantified. **Default:** 60 seconds before `expiresIn`.
10. **E2E access to a raw reset token.** The FDS delivers it only through the backend console (`ConsoleMailer`). **Default** if no test seam is agreed: E2E covers only the missing and invalid token states. The valid-token path is covered by frontend component tests plus backend API tests.
11. **Known limitation (informational).** The single-flight refresh prevents rotation races within one tab. Two tabs refreshing at the same instant could still race, and the loser would be signed out. The spec does not address multi-tab behavior, so no mitigation is planned.
