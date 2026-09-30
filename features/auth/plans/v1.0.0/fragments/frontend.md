# Frontend Plan Fragment: Authentication and Identity (`auth`) v1.0.0

> **SUPERSEDED.** Stale after revision 1. Kept as an audit trail only; do not use as synthesis input. The authoritative sources are `../plan.md` and `../contract.md` (revision 3).

Status: DRAFT fragment (input to the Plan Synthesizer). Author: Frontend Subagent. Scope: Frontend and Frontend-Testing only.
Revision: cycle 1 (applies the frontend side of the developer-approved review decisions B-2, B-3, B-4 and advisories 5, 6, 9, 10a/b, 13).
Sources: `features/auth/fds.md` (v1.0.0), `features/auth/behavior.md`, `features/auth/visuals/auth-signin-page.png`,
`features/auth/visuals/auth-signup-page.png`, `rules/*`, `features/index.json`, existing `frontend/src`.

This fragment does not define the API contract. Every "needs from backend" entry is an intent plus field list; the
Synthesizer formalizes it. Operation names below (`register`, `login`, ...) are the FDS section 6 names, used as labels only.

---

## 1. Scope Summary

The frontend delivers:

1. `/auth` — one route, two views (`?mode=signin` default, `?mode=signup`), a sliding two-panel card.
2. Google SSO button on both views.
3. Forgot-password dialog on the Sign In view.
4. `/reset-password?token=...` confirmation page.
5. Session lifecycle in the browser: restore on load, in-memory access token, proactive and reactive renewal, logout.
6. Client-side route guard (protected layout, guest-only `/auth`, root `/` redirector).
7. A placeholder `/dashboard` page (user name + "Sign out") inside the protected layout.
8. A toast facility (error and success) used by auth flows and reusable by later features.

Out of frontend scope: any token verification, hashing, account resolution, reset-token logic, or business rules. The
frontend only validates input shape for instant feedback (`rules/architecture.md` Validation).

---

## 2. Observations, Decisions and Items Needing Approval

None of these block drafting (no contradictions between FDS, behavior spec and rules were found). They are listed so the
Synthesizer and the developer can confirm them at the approval gate.

### 2.1 Constraints derived from `rules/` (no new libraries)

- **No icon library is approved.** Mail, lock, user, eye / eye-off, close, spinner and Google-fallback glyphs are inline SVG
  components in `components/auth/auth-icons.tsx`. Nothing like `lucide-react` is added.
- **No toast library is approved** (only `@radix-ui/react-dialog` and `@radix-ui/react-label` from Radix). The toast facility
  is a small in-house provider (`components/ui/toast-provider.tsx`).
- `@react-oauth/google` is approved for this feature (FDS section 2) but is **not yet in `frontend/package.json`**; the Frontend
  Build adds it (`frontend/` only). No other dependency is added.
- Fonts via `next/font/google` (part of Next.js, not a new library): Inter (body; `tailwind.config.ts` already references
  `--font-inter`, but `layout.tsx` does not load it yet) and Poppins (headings; the titles in the visuals appear to be Poppins).

### 2.2 Copy not specified by the spec (proposed, confirm at approval)

| Where                          | Proposed copy                                                                                                                                                                                                                |
| :----------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reset page heading             | `"Set a new password"` (FDS gives fields and button only)                                                                                                                                                                    |
| Placeholder dashboard heading  | `"Welcome, {user.name}"` (FDS: "showing the signed-in user's name")                                                                                                                                                          |
| Loading state accessible label | `"Loading"` (visually a centered spinner, `role="status"`)                                                                                                                                                                   |
| Field placeholders / labels    | `Name`, `Email`, `Password`, `Confirm Password`, `New Password`, `Confirm New Password` (from visuals / FDS)                                                                                                                 |
| Logo                           | No logo asset exists in `visuals/`. A `FinTrackLogo` inline-SVG/text wordmark ("FinTrack" + "Track smarter. Save better." tagline, arrow glyph on the "T") approximates the screenshot. Replace if a real asset is supplied. |

### 2.3 Behaviors the spec leaves open, with the plan's chosen handling

1. **Reset while signed in.** FDS: after reset the user is redirected to `/auth` and "is not signed in automatically", and all refresh
   tokens are revoked. If the browser still holds an in-memory session, `/auth` would bounce to `/dashboard`. Plan: on reset success the
   frontend discards its local session (token store + user) before `router.replace("/auth?mode=signin")`.
2. **Reset page for authenticated users.** Spec is silent; `/reset-password` is NOT guest-guarded (it is reachable in any auth state).
3. **Inline sign-in error lifetime.** Cleared on the next submit, on mode switch, and when the dialog/link flow is opened. Not cleared on
   every keystroke.
4. **Renewal lead time.** "Shortly before it expires" is implemented as a named constant `ACCESS_TOKEN_REFRESH_LEAD_SECONDS = 60`,
   computed against the `expiresIn` value the backend returns (so the frontend never hard-codes the 15-minute lifetime).
5. **Google `onError` and undefined credential.** `<GoogleLogin>`'s `onError` is treated as "no user-visible feedback" (matches "popup dismissed: no error").
   An `onSuccess` callback whose `credential` is `undefined` or an empty string is treated as a dismissal too: no request, no toast, no state change.
   The only two Google frontend toasts are the unavailable case (client id missing or script load failed) and backend rejection.
6. **Responsive behavior.** Visuals show desktop only; `rules/tech-stack.md` requires responsive, accessible design. Plan: below the
   `md` breakpoint the card stacks vertically (brand banner on top, collapsed to logo + mode-switch button; no sliding animation, view
   swap only). Needs developer confirmation because there is no visual reference. Covered by a component test (10.1, 16a).
7. **API base URL and frontend env delivery.** The existing home page hard-codes `http://localhost:4000`. Plan introduces `NEXT_PUBLIC_API_BASE_URL`
   (default `http://localhost:4000`). Next.js loads `.env*` files only from the app directory, so both frontend variables
   (`NEXT_PUBLIC_API_BASE_URL`, and `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, optional) live in **`frontend/.env.local`** (already git-ignored) and are documented by a
   committed **`frontend/.env.example`** (defaults: `http://localhost:4000`; empty Google client id). The repo-root `.env.example` keeps only backend
   variables and points to `frontend/.env.example` for the two `NEXT_PUBLIC_*` variables. `frontend/.env.example` is created by the spec/catalog
   phase (Phase 0), not by a Frontend Build task; the Frontend Build only reads the variables and never commits `.env.local`. The Playwright frontend
   `webServer` must pass both `NEXT_PUBLIC_*` values through `webServer.env` explicitly, so E2E never depends on a developer's local `.env.local`
   (root `playwright.config.ts` is owned by the Test phase; flagged for the Synthesizer).
8. **Existing e2e smoke test.** `e2e/smoke.spec.ts` asserts an `h1` "Expense Tracker" at `/`; REQ-AUTH-07 replaces that page. The
   smoke test must be updated in the Test phase (it lives outside `frontend/`, so the Frontend Build must not touch it).

### 2.4 Requirements on the contract package (for the Synthesizer)

Field messages are defined once in `packages/contracts` and consumed verbatim by the frontend (FDS section 5). The frontend needs
these to be exported in a form usable by React Hook Form's Zod resolver:

- A sign-up input schema (`name`, `email`, `password`, `confirmPassword`) whose `confirmPassword` mismatch error is attached to the
  `confirmPassword` field path.
- A sign-in input schema (`email`, `password`; password only requires non-empty, message `Password is required.`).
- A forgot-password input schema (`email`).
- A reset-password input usable **without `token`** for the form (the token comes from the URL). If the contract schema uses
  `.refine` on the object, an un-refined base object (or a dedicated form schema) must also be exported so `token` can be omitted.
- Inferred types (`z.infer`) for `AuthUser`, the session response (`user`, `accessToken`, `expiresIn`), and the error body
  (`code`, `message`, optional `fieldErrors`), so the frontend defines no duplicate types.

**Sequencing dependency (deliberate deviation from fully parallel builds).** The contracts package is the first Backend Build task and is
committed before the Frontend session starts; the Backend session then continues in parallel. The frontend therefore consumes the committed
`@expense-tracker/contracts` package (already a workspace dependency of `frontend/package.json`) **read-only** from the first task on:

- No provisional local types, no local schemas, and no duplicated FDS message strings anywhere in `frontend/`.
- `frontend/src/lib/auth/api-client.ts` builds the ts-rest React Query client from the shared contract (section 4.6). There is no parallel or shim client.
- During the Frontend session the backend does not exist yet, so the network is stubbed by replacing the global `fetch` (section 8). Fixtures are typed
  from the contract-inferred types and validated against the contract response schemas.

Path boundary: Frontend Build touches only `frontend/`; it never edits `packages/contracts`. If the committed contract lacks an export listed above,
the Frontend session stops and reports it rather than defining a local substitute.

---

## 3. Routes and File Layout (all under `frontend/src`, kebab-case files, PascalCase components)

```
app/
  layout.tsx                      MODIFY: load Inter + Poppins, wrap children in <Providers>
  providers.tsx                   NEW: QueryClientProvider > ToastProvider > AuthProvider (no Google provider here)
  page.tsx                        REPLACE: root redirector (REQ-AUTH-07)
  auth/page.tsx                   NEW: <Suspense> + <AuthPageContent/> (useSearchParams requires Suspense); AuthPageContent renders
                                  <GoogleAuthProvider> around the guest-only auth card, so Google's script loads on /auth only
  reset-password/page.tsx         NEW: <Suspense> + <ResetPasswordContent/>
  (protected)/layout.tsx          NEW: <ProtectedRoute> guard around {children}
  (protected)/dashboard/page.tsx  NEW: placeholder page (name + Sign out)
components/
  ui/
    button.tsx                    cva variants (primary teal, ghost/link), loading state
    dialog.tsx                    Radix Dialog wrappers (Overlay, Content, Title, Description, Close)
    label.tsx                     Radix Label wrapper (used by visually-hidden field labels)
    toast-provider.tsx            ToastProvider + useToast() (success | error), viewport, auto-dismiss
    full-screen-loader.tsx        centered spinner, role="status"
  auth/
    auth-card.tsx                 card shell, overlay slide, form slots
    auth-brand-panel.tsx          overlay content (logo, headline, subtext, toggle button) for either mode
    fintrack-logo.tsx
    auth-icons.tsx                MailIcon, LockIcon, UserIcon, EyeIcon, EyeOffIcon, CloseIcon, SpinnerIcon, GoogleGlyph
    auth-text-field.tsx           icon-adorned input + inline error (RHF-agnostic presentational)
    password-field.tsx            auth-text-field + trailing eye toggle (REQ-AUTH-04)
    sign-in-form.tsx
    sign-up-form.tsx
    google-auth-provider.tsx      GoogleAuthProvider (wraps GoogleOAuthProvider) + availability context, useGoogleAvailability(): { available: boolean }
    google-sign-in-button.tsx     GoogleLogin wrapper + fallback (unavailable) button; reads useGoogleAvailability()
    forgot-password-dialog.tsx
    reset-password-form.tsx
    reset-link-invalid.tsx        "This reset link is invalid or has expired." + link to /auth
    protected-route.tsx           guard (REQ-AUTH-07)
    guest-only-route.tsx          used by /auth
hooks/
  use-sign-in.ts | use-sign-up.ts | use-google-sign-in.ts | use-request-password-reset.ts | use-reset-password.ts | use-logout.ts
lib/
  utils.ts                        cn() = twMerge(clsx())
  auth/
    auth-provider.tsx             AuthProvider + useAuth()
    auth-state.ts                 types: AuthState discriminated union
    token-store.ts                in-memory access token (module variable; never web storage)
    session-refresher.ts          single-flight refreshSession + proactive timer
    api-client.ts                 ts-rest React Query client + auth-aware fetcher
    auth-errors.ts                maps API error bodies to UI feedback (pure functions)
    auth-constants.ts             routes, mode values, timings, message strings not owned by the contract
mocks/
  auth-fixtures.ts                typed fetch-stub fixtures + helper (section 8); relocated to test/ at Integration
test/
  setup.ts                        existing; extend with matchMedia/ResizeObserver stubs only if needed
```

Outside `src` (documented, not part of the Frontend Build): `frontend/.env.local` (git-ignored, developer-local) and `frontend/.env.example`
(committed at Phase 0; see 2.3 item 7).

Hooks isolate server-state (mutations) from presentational components (`rules/conventions.md` Components).
Components receive callbacks and data; they do not call `fetch` directly.

---

## 4. Session and Auth Infrastructure (frontend logic, no business rules)

### 4.1 State model

```ts
type AuthState = { status: "restoring" } | { status: "authenticated"; user: AuthUser } | { status: "unauthenticated" };
```

`AuthProvider` exposes `useAuth()` returning `{ state, establishSession(session), clearSession(), logout() }`.
The access token is held ONLY in `token-store.ts` (module-scoped variable with `getAccessToken` / `setAccessToken` / `clearAccessToken`).
It is never put in React state that is serialized, `localStorage`, `sessionStorage`, cookies, or URL.

### 4.2 Restore on load (REQ-AUTH-06, behavior section 7)

- `AuthProvider` mounts in `restoring`, calls `refreshSession` once, then moves to `authenticated` (token + user stored, renewal timer
  scheduled from `expiresIn`) or `unauthenticated` (on `401`, network error, or `5xx`; no toast per FDS section 5).
- **Single-flight is mandatory.** The refresh token rotates on every use; two concurrent refreshes would revoke each other. All
  callers (restore, timer, 401-retry) share one in-flight promise in `session-refresher.ts`. This also neutralizes React 18 Strict
  Mode's double-invoked effects in development.
- `restoring` renders the loading state in guarded routes (never protected content, never a redirect flash).

### 4.3 Renewal

- Proactive: after every successful establish/refresh, schedule `setTimeout(refresh, max(expiresIn - ACCESS_TOKEN_REFRESH_LEAD_SECONDS, 0) * 1000)`;
  the timer is cleared on logout/clear and on unmount.
- Reactive: the auth-aware fetcher in `api-client.ts` attaches `Authorization: Bearer <token>` and sends `credentials: "include"` on every
  request. If a protected request returns `401` with code `UNAUTHENTICATED`, it awaits the shared refresh, retries the original request
  **once** with the new token, and returns that result. If the refresh fails, it calls `clearSession()`; the guard then redirects to `/auth`.
- The retry path is skipped for the public/cookie auth operations (`register`, `login`, `googleOAuthLogin`, `refreshSession`, `logout`,
  `requestPasswordReset`, `resetPassword`) to avoid loops; a `401` from those is handled by their own UI states.

### 4.4 Establish / clear / logout

- `establishSession({ user, accessToken, expiresIn })`: store token, set `authenticated`, schedule renewal.
- `clearSession()`: clear token, cancel timer, `queryClient.clear()`, set `unauthenticated`.
- `logout()`: call `logout` operation; regardless of the outcome (including network failure), run `clearSession()` and navigate to `/auth`
  (behavior section 7: local session is cleared even if the call fails).

### 4.5 Guards

- `ProtectedRoute` (in `(protected)/layout.tsx`): `restoring` -> `<FullScreenLoader/>`; `unauthenticated` -> `router.replace("/auth")`
  while still rendering the loader (no protected content flash); `authenticated` -> children. The `/transactions`, `/budget`, `/goals`, `/reports`
  and `/profile` pages do not exist in this feature, so the guard covers them by construction of the `(protected)` route group only: any page a later
  feature adds under `(protected)` is guarded automatically. Today an unauthenticated visit to those paths is a Next.js 404, not a redirect, and
  only `/dashboard` is verifiable (E2E 10) until later features add pages.
- `GuestOnlyRoute` (wraps the `/auth` content): `restoring` -> loader; `authenticated` -> `router.replace("/dashboard")`; `unauthenticated` -> form.
- Root `/`: `restoring` -> loader; then `replace("/dashboard")` or `replace("/auth")`.

### 4.6 API client

`api-client.ts` builds the single ts-rest React Query client (`@ts-rest/react-query`) from the committed `@expense-tracker/contracts` package, with `baseUrl` from
`NEXT_PUBLIC_API_BASE_URL`, `credentials: "include"`, and the custom fetcher above. Hooks call this client only; no ad-hoc `fetch`
(replaces the hard-coded health-check fetch that leaves with the old `page.tsx`). There is no parallel or provisional client: the same client is used
against stubbed `fetch` during the Frontend session and against the real backend at Integration, and request/response/error types are the contract-inferred types.

---

## 5. Screens, Components and Interaction Details

### 5.1 `/auth` — `AuthCard`

**URL/state.** `mode` is derived from `useSearchParams()`: `"signup"` -> sign-up; anything else (absent, unrecognized) -> `"signin"`.
Panel toggle buttons call `router.push("/auth?mode=<other>", { scroll: false })` (a push, not replace, so browser Back works; no full reload).

**Layout (measured from the screenshots, which are 2x captures of a 1440px-wide viewport):**

| Element             | Value (CSS px, approx.)                                                                                    |
| :------------------ | :--------------------------------------------------------------------------------------------------------- |
| Page background     | `#f8fafc`, card centered both axes                                                                         |
| Card                | 800 x 600, large radius (~24-28px), soft drop shadow, `overflow-hidden`                                    |
| Brand overlay panel | 40% of card width (320px), full height, diagonal gradient `#4acaac` (top-left) to `#17594c` (bottom-right) |
| Form panel          | 60% of card width (480px); inputs 320 x 50, 1px `#e0e0e0` border, small radius, `#999999` placeholder      |
| Action buttons      | ~160 x 40, solid `#00b894`, white uppercase label, small radius                                            |
| Headings            | Poppins bold, `#333333`; overlay headline white bold, subtext white regular                                |
| Logo                | top-center of overlay panel                                                                                |

These become Tailwind extension tokens (`brand.teal`, `brand.gradient.from`, `brand.gradient.to`, `surface`, `ink`, etc.) in
`tailwind.config.ts`. The existing `primary`/`accent` blue tokens are left untouched; auth uses its own teal tokens.

**Sliding mechanics.** One absolutely-positioned overlay panel (`w-2/5`) translates between the left edge (`mode=signup`) and the
right edge (`mode=signin`, `translate-x-[150%]`) with `transition-transform duration-500 ease-in-out`. Two form slots (each `w-3/5`): the
sign-in form sits in the left slot, the sign-up form in the right slot. Only the active form is mounted (its slot fades in), so field
values and inline errors of the hidden view are cleared on switch by unmounting (behavior section 2). Because the outgoing form disappears at once while the
overlay is still sliding over its slot, a brief blank moment is possible; a short cross-fade of the outgoing form is a candidate refinement for the Phase 6 UI review
(presentation only, no spec change; unmount-on-switch stays the baseline). Overlay copy cross-fades:

| Mode     | Overlay headline | Overlay subtext                                         | Overlay button |
| :------- | :--------------- | :------------------------------------------------------ | :------------- |
| `signup` | `Welcome Back!`  | `Log in to manage your finances.`                       | `SIGN IN`      |
| `signin` | `Hello, Friend!` | `Enter your personal details and start journey with us` | `SIGN UP`      |

Animations honor `prefers-reduced-motion` (transition disabled; view swaps instantly). After a switch, focus moves to the first field of
the newly active form. Overlay toggle buttons are `type="button"`.

**Mobile (`< md`).** See 2.3 item 6.

### 5.2 `SignUpForm` (REQ-AUTH-01, behavior section 3)

- Title `Create Account` (Poppins bold), then `GoogleSignInButton`, divider copy `or use your email for registration`.
- Fields (icon adornments): Name (user icon), Email (mail icon), Password (lock icon + eye toggle), Confirm Password (lock icon + eye toggle).
  Each password field has its own independent visibility toggle (`type="password"` <-> `type="text"`, `aria-label` "Show password" /
  "Hide password", `aria-pressed`, button `type="button"`).
- Submit button `SIGN UP`.
- Validation: React Hook Form + `zodResolver` with the contract sign-up schema; `mode: "onSubmit"`, `reValidateMode: "onChange"`. Invalid ->
  inline messages under each failing field (first failing rule per field, verbatim contract copy from FDS section 5), no request, focus first
  invalid field. Fields carry `aria-invalid` and `aria-describedby` for the error node (`role="alert"` on submit-time errors).
- Submit in flight: button `disabled`, shows spinner + label stays, `aria-busy`; all inputs `readOnly` to prevent double submit.
- Outcomes:
  - Success: `establishSession(...)`, `router.replace("/dashboard")`.
  - `409 EMAIL_ALREADY_EXISTS`: error toast `"An account with this email already exists."`. Form values retained.
  - `400 VALIDATION_ERROR` with `fieldErrors` (defensive; client validation normally preempts): map each key to the matching field via `setError`.
  - Any other failure (network, `5xx`, unexpected): error toast `"Could not create your account. Please try again."`.

### 5.3 `SignInForm` (REQ-AUTH-02, behavior section 4)

- Title `Sign in to FinTrack`, `GoogleSignInButton`, divider `or use your account`.
- Fields: Email (mail icon), Password (lock icon + eye toggle). Text link-button `Forgot your password?` (opens the dialog), submit `SIGN IN`.
- Validation: contract sign-in schema; empty/malformed fields flagged inline (`Email is required.`, `Enter a valid email address.`, `Password is required.`);
  no request when invalid. The password strength rule is NOT applied to sign-in.
- In flight: same disabled/spinner treatment as sign-up.
- Outcomes:
  - Success: `establishSession`, `router.replace("/dashboard")`.
  - `401 INVALID_CREDENTIALS`: inline error `"Invalid email or password"` below the password field (`role="alert"`), and both credential input boxes get a
    horizontal shake (`animate-shake` keyframe defined in `tailwind.config.ts`, ~400ms, disabled under reduced motion). Identical for every cause; the frontend
    has no information to distinguish causes and MUST NOT vary the message.
  - Other failure: error toast `"Could not sign in. Please try again."`.

### 5.4 `GoogleSignInButton` (REQ-AUTH-03, behavior section 5)

- Rendered on both views, centered between the title and the divider copy.
- `GoogleAuthProvider` (`components/auth/google-auth-provider.tsx`) wraps `GoogleOAuthProvider` (client id = `process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID`) only when the id is a
  non-empty string, and is rendered by the `/auth` page content only (not by the global `providers.tsx`), so Google's script is not loaded on `/dashboard` or `/reset-password`.
  It exposes a small React context, `useGoogleAvailability(): { available: boolean }`, that combines "client id configured" and the script-load-error state
  (`onScriptLoadError` flips it to unavailable). `GoogleSignInButton` reads this context; both auth views share the same flag.
- Available: render `<GoogleLogin type="icon" ... />` (Google's own multicolor button; accepted deviation from the grey G in the visuals). `onSuccess(credential)` ->
  `googleOAuthLogin` with the ID token. Reserve the button's footprint while Google's script loads to avoid layout shift.
- Unavailable (client id missing or script load failed): render a same-sized fallback icon button (grey G glyph, matches the visual reference). Clicking it shows the
  error toast `"Google sign-in is unavailable."`.
- Popup dismissed/closed, `onError`, or `onSuccess` with an undefined/empty `credential`: no request, no toast, no state change, form untouched (2.3 item 5).
- Backend outcomes: success -> `establishSession` + `router.replace("/dashboard")` (covers new, existing Google, and newly linked accounts identically). `401 INVALID_GOOGLE_TOKEN`
  or any other failure -> error toast `"Google sign-in failed. Please try again."`. While the backend call is in flight, disable the auth form submit to prevent concurrent sessions.

### 5.5 `ForgotPasswordDialog` (REQ-AUTH-05 step 1, behavior section 6)

- Radix Dialog opened by the `Forgot your password?` trigger; title `Reset your password`; email field (mail icon); submit `SEND RESET LINK`; close control (X, `aria-label` "Close").
  Closes on Escape, overlay click, and close control; Radix returns focus to the trigger (trigger must be a real `button` rendered as the `Dialog.Trigger`).
- Internal state machine: `idle -> submitting -> sent`, with `error` returning to `idle` semantics:
  - `idle`: email input + button. Invalid/empty email -> inline error (`Email is required.` / `Enter a valid email address.`), no request.
  - `submitting`: button disabled with spinner.
  - `sent` (any `200`): the form is replaced by the generic message `"If an account exists for that email, a reset link has been sent."` and a `BACK TO SIGN IN` button that closes the dialog.
    The frontend renders the same message text regardless of the response body content beyond success, so it cannot leak account existence.
  - Request failure (network/5xx/other): inline dialog error `"Could not send the reset link. Please try again."`; form stays open with the email retained.
- Dialog state (email value, errors, sent flag) resets each time the dialog closes.
- Dialog has `Dialog.Description` (a short sentence) for accessibility. Copy proposal: none visible in the spec, so the description is a visually-hidden equivalent of the title context; confirm if visible copy is wanted.

### 5.6 `/reset-password` — `ResetPasswordContent` (REQ-AUTH-05 step 2, behavior section 6)

- Reads `token` from `useSearchParams()`. Missing or empty -> render `ResetLinkInvalid` immediately; **no API call**.
- Otherwise a centered card (single column, max ~420px, same shadow/radius language as the auth card, logo above) with heading (proposed, 2.2), **New Password**
  and **Confirm New Password** (lock icon, eye toggles), and `RESET PASSWORD`.
- Validation: contract reset schema minus `token` (section 2.4): password rules from FDS section 5 (`Password is required.`, `Password must be at least 8 characters.`,
  `Password must include a number.`, `Password must include a special character.`) and `confirmPassword` (`Please confirm your password.`, `Passwords do not match.`), inline.
- In flight: disabled button + spinner.
- Outcomes:
  - Success: discard local session (2.3 item 1), show success toast `"Password updated. Please sign in."`, `router.replace("/auth?mode=signin")`. The toast provider lives in the
    root layout so the toast survives the navigation. User is not signed in.
  - `400 INVALID_RESET_TOKEN`: replace the form with `ResetLinkInvalid` (`"This reset link is invalid or has expired."` plus a link to `/auth`).
  - `400 VALIDATION_ERROR` with `fieldErrors`: map to fields inline (defensive).
  - Any other failure: inline form error `"Could not reset your password. Please try again."` (form stays).

### 5.7 Placeholder `/dashboard` (REQ-AUTH-06 Logout control, REQ-AUTH-07)

- Inside `(protected)` layout. Shows `Welcome, {user.name}` (heading, `h1`) and a `Sign out` button. Clicking calls `logout()` from `useAuth()` (4.4), then lands on `/auth`.
- Minimal styling only; the `dashboard` feature replaces this page later and the guard/layout stay auth-owned.

### 5.8 Root `/`

Loader while `restoring`, then `replace` to `/dashboard` or `/auth`. Replaces the health-check page.

### 5.9 Toasts (`ToastProvider`)

- API: `useToast()` returning `{ showSuccess(message), showError(message) }`. Viewport fixed top-right, stacked, `role="status"` (success) / `role="alert"` (error), auto-dismiss
  after `TOAST_DURATION_MS = 5000`, manual dismiss button, pause on hover/focus.
- Rendered in `app/providers.tsx` (root) so toasts persist across route changes.
- Visual style is provisional (auth visuals define none; toast visuals live in the transactions/budget/goals specs and are not consulted from this fragment). Later features may restyle the shared component.

### 5.10 Empty / Error / Loading state inventory

| Context                          | Loading                              | Error                                                               | Empty               |
| :------------------------------- | :----------------------------------- | :------------------------------------------------------------------ | :------------------ |
| Session restore (guarded routes) | `FullScreenLoader`                   | treated as unauthenticated, no toast                                | n/a                 |
| Sign in / Sign up submit         | disabled button + spinner            | inline field errors, inline credentials error, or toast (per above) | n/a                 |
| Google exchange                  | form submit disabled while in flight | toast (`unavailable` / `failed`)                                    | n/a                 |
| Forgot dialog                    | disabled button + spinner            | inline dialog error                                                 | n/a                 |
| Reset page                       | disabled button + spinner            | inline form error, or invalid-link state                            | missing-token state |
| Logout                           | button disabled while pending        | ignored (local session cleared regardless)                          | n/a                 |

---

## 6. Form and Validation UX Rules (shared)

- Client validation runs from the contract Zod schemas only; the frontend defines no message strings for fields (FDS section 5). Non-field copy (toasts, dialog messages, overlay text)
  lives as named constants in `auth-constants.ts` (no magic strings, per `rules/conventions.md`), except copy that the contract owns.
- Email is trimmed before validation/submit; lowercase normalization is the backend's job (the frontend sends the value as entered, trimmed).
  The sign-up name is trimmed the same way (plan decision D-8), so a whitespace-only name is validated as empty and reports the contract's empty-name message.
- No password is ever logged, stored, or placed in the URL; password inputs use `autoComplete` (`current-password` for sign-in, `new-password` for sign-up/reset), email `autoComplete="email"`,
  name `autoComplete="name"`.
- Enter submits the focused form. Labels: every input has an accessible name (visually hidden `Label` where the visual shows a placeholder only).
- Only one submit can be in flight per form.

---

## 7. Design Tokens and Styling Tasks (frontend only)

- `tailwind.config.ts`: add colors (`brand.teal #00b894`, `brand.gradient.from #4acaac`, `brand.gradient.to #17594c`, `surface #f8fafc`, `ink #333333`, `placeholder #999999`,
  `field-border #e0e0e0`), `boxShadow.card`, `borderRadius.card`, `keyframes.shake` + `animation.shake`, `fontFamily.heading` (Poppins var). Existing tokens untouched.
- `app/layout.tsx`: `next/font/google` Inter (`--font-inter`) and Poppins (`--font-poppins`), `<Providers>` wrapper.
- `globals.css`: no changes beyond Tailwind layers unless the reduced-motion rule is easier there.

---

## 8. Typed Fetch-Stub Fixtures to Build Against

The frontend only ever sees the public subset of the FDS data model (never `passwordHash`, `googleId`, `provider`, token hashes, or the refresh token, which lives in an HTTP-only cookie).
Fixtures live in `frontend/src/mocks/auth-fixtures.ts` during the Frontend session (relocated to `frontend/src/test/` at Integration). They define **no types of their own**:
success and error bodies are typed via types inferred from `@expense-tracker/contracts` (`AuthUser`, session response, error body) and validated against the contract
response schemas, so a fixture that drifts from the contract fails a test. The shapes below are illustrative of what the inferred types contain (field lists per the FDS), not
declarations to copy:

```ts
// Types come from the contract, e.g. (illustrative import names; use whatever the committed package exports):
import type { AuthUser, AuthSessionResponse, AuthErrorBody } from "@expense-tracker/contracts";
// AuthUser: { id, name, email }; AuthSessionResponse: { user, accessToken, expiresIn (seconds) }; AuthErrorBody: { code, message, fieldErrors? }

const mockUser: AuthUser = {
  id: "b7c1f3a2-6d1e-4c0b-9d0e-2f8a5b7c9e10",
  name: "Piyush Kumar",
  email: "piyush@example.com",
};

const mockSession: AuthSessionResponse = { user: mockUser, accessToken: "mock.jwt.access-token", expiresIn: 900 };

// Error bodies the UI must handle (codes are those named in FDS section 6):
const mockInvalidCredentials: AuthErrorBody = { code: "INVALID_CREDENTIALS", message: "..." }; // 401
const mockEmailExists: AuthErrorBody = { code: "EMAIL_ALREADY_EXISTS", message: "..." }; // 409
const mockInvalidGoogleToken: AuthErrorBody = { code: "INVALID_GOOGLE_TOKEN", message: "..." }; // 401
const mockUnauthenticated: AuthErrorBody = { code: "UNAUTHENTICATED", message: "..." }; // 401
const mockInvalidResetToken: AuthErrorBody = { code: "INVALID_RESET_TOKEN", message: "..." }; // 400
const mockValidationError: AuthErrorBody = {
  code: "VALIDATION_ERROR",
  message: "...",
  fieldErrors: { password: "Password must include a number." },
};

// requestPasswordReset success: { success: true, message: "If an account exists for that email, a reset link has been sent." }
// resetPassword / logout success: { success: true }
```

Fixtures also export a small helper for tests to stub the global `fetch` per URL/method with these bodies and to assert request bodies, headers (`Authorization`), and `credentials: "include"`.
Fixture error-body `message` values are opaque placeholders (the frontend never renders API `message` text for these flows); no FDS message string is duplicated in the frontend. At Integration the stub
harness is removed from production paths (it is a test-only helper) and fixtures move to `frontend/src/test/`.

---

## 9. What the Frontend Needs from the Backend (plain-language; NOT a contract)

| Screen / interaction                    | Reads                                                                                                                                                                                                 | Writes                                                                           |
| :-------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------- |
| App load / any reload (session restore) | Using the refresh cookie only (no body): the current `user` (`id`, `name`, `email`), a new `accessToken`, and `expiresIn` (seconds); a clear `401` when the cookie is missing/invalid/revoked/expired | Rotates the refresh cookie (frontend does not touch it; browser handles it)      |
| Sign Up submit                          | On success: `user`, `accessToken`, `expiresIn`; on duplicate email: a distinguishable conflict result (`EMAIL_ALREADY_EXISTS`); on validation failure: per-field messages (`fieldErrors`)             | Send `name`, `email`, `password`, `confirmPassword`; backend sets refresh cookie |
| Sign In submit                          | On success: `user`, `accessToken`, `expiresIn`; on any bad credential: one indistinguishable failure (`INVALID_CREDENTIALS`)                                                                          | Send `email`, `password`; backend sets refresh cookie                            |
| Google button success                   | On success: `user`, `accessToken`, `expiresIn` (new, existing, or linked account look identical); on rejection: `INVALID_GOOGLE_TOKEN`                                                                | Send the Google ID token (`credential`) as `token`; backend sets refresh cookie  |
| Forgot dialog submit                    | A success acknowledgement for every well-formed email (registered or not); the frontend shows its own fixed copy and does not depend on the message text                                              | Send `email`                                                                     |
| Reset page submit                       | Success acknowledgement; `INVALID_RESET_TOKEN` for unknown/expired/used token; per-field messages for validation failures                                                                             | Send `token` (from URL), `password`, `confirmPassword`                           |
| Sign out (dashboard placeholder)        | Success acknowledgement (must also succeed when no valid cookie is present); frontend does not depend on the body                                                                                     | Backend revokes refresh token and clears the cookie; frontend sends no body      |
| Any protected request from any feature  | `401 UNAUTHENTICATED` when the access token is missing/expired so the client can refresh once and retry                                                                                               | Frontend sends `Authorization: Bearer <accessToken>` on every protected call     |
| (Not consumed by this frontend in v1)   | `getCurrentUser` is available but the frontend derives the user from the session responses; no call planned                                                                                           | n/a                                                                              |

Cross-cutting needs:

1. **CORS with credentials** for the frontend origin (`http://localhost:3000` in dev), allowing the `Authorization` header; the frontend sends `credentials: "include"` on auth calls.
2. **Error shape** exactly `{ code, message, fieldErrors? }` so the client can branch on `code` and map `fieldErrors` keys to form field names (`name`, `email`, `password`, `confirmPassword`).
3. **Contract exports** listed in section 2.4 (committed before the Frontend session starts), plus the API base URL / path prefix decision (section 2.3 item 7); the two `NEXT_PUBLIC_*` variables are delivered through `frontend/.env.local` / `frontend/.env.example` (2.3 item 7).
4. **Refresh must be safe to call from a fresh page load** with no `Authorization` header (cookie only).
5. **Dev delivery of the reset link** is the backend console (`ConsoleMailer`); the frontend needs no mail-related endpoint.

---

## 10. Frontend-Testing Requirements

Tools per `rules/tech-stack.md`: Vitest + React Testing Library + jest-dom + jsdom (component/unit), Playwright (E2E). Coverage target for the feature is 95% (`fds.md` frontmatter);
the frontend portion should aim for it, with the pure modules (`auth-errors`, `session-refresher`, `token-store`) fully covered. Test files are colocated (`*.test.tsx` / `*.test.ts`), independent, and set up/tear down their own data.
No new test libraries; network is stubbed by replacing the global `fetch` (typed helper in `mocks/auth-fixtures.ts`; the real contract-built `api-client` runs under test, never a parallel client); `@react-oauth/google` is mocked with `vi.mock`; `next/navigation` is mocked (`useRouter`, `useSearchParams`, `usePathname`); fake timers for renewal.

### 10.1 Component / unit tests (Vitest)

Sign Up (`sign-up-form.test.tsx`)

1. Renders title `Create Account`, four fields, both eye toggles, divider copy, `SIGN UP`.
2. Empty submit shows `Name is required.`, `Email is required.`, `Password is required.`, `Please confirm your password.`; no fetch call.
3. Each validation message from FDS section 5 appears for its rule (name < 2, bad email, password < 8 / no digit / no special char (space and underscore count as special), mismatch).
   3a. A whitespace-only name (e.g. `"   "`) is trimmed and reported as empty (`Name is required.`, the contract message); no request is sent (plan decision D-8).
4. Eye toggles switch `type` between `password` and `text` independently per field; `aria-pressed` updates.
5. Valid submit: one request with the four fields; button disabled + busy while pending; on success establishes session and navigates to `/dashboard`.
6. `409 EMAIL_ALREADY_EXISTS` -> toast `An account with this email already exists.`; values retained; no navigation.
7. Network/`5xx` -> toast `Could not create your account. Please try again.`
8. `VALIDATION_ERROR` `fieldErrors` mapped inline.

Sign In (`sign-in-form.test.tsx`)

9. Empty/malformed submit flagged inline, no request; sign-in does not apply password strength rules (a weak non-empty password is submitted).
10. `401 INVALID_CREDENTIALS` -> inline `Invalid email or password` and shake class on both inputs; identical rendering for repeated failures.
11. Success -> session established, navigation to `/dashboard`.
12. Other failure -> toast `Could not sign in. Please try again.`
13. `Forgot your password?` opens the dialog.

Auth card (`auth-card.test.tsx`)

14. `mode` absent/unknown -> sign-in view; `mode=signup` -> sign-up view with the correct overlay copy per mode (table 5.1).
15. Overlay button pushes `/auth?mode=<other>`; typed values and errors are gone after switching away and back.
16. Only the active view's form is in the DOM; focus moves to its first field.
    16a. Mobile layout (plan decision D-6): with the viewport below `md` (stubbed `matchMedia`/window width), the card is stacked (brand banner on top, logo + mode-switch button), the switch swaps the view, and no slide-transition classes (`translate-x-*`, `transition-transform`) are applied to the overlay.

Google (`google-sign-in-button.test.tsx`)

17. Client id missing -> fallback button; click shows `Google sign-in is unavailable.`
18. Script load error -> fallback + same toast.
19. `onSuccess` posts `{ token: <credential> }`; success navigates to `/dashboard`.
20. `INVALID_GOOGLE_TOKEN` (and other failure) -> toast `Google sign-in failed. Please try again.`
21. `onError` / dismissal, and `onSuccess` with an undefined or empty `credential` -> no toast, no state change, no request.
    21a. `GoogleAuthProvider` / `useGoogleAvailability()`: `available` is `false` when the client id is missing or empty and after `onScriptLoadError`, `true` otherwise; both auth views' buttons read the same value; the provider is not mounted outside the `/auth` page subtree (`/dashboard` and `/reset-password` render no Google script).

Forgot dialog (`forgot-password-dialog.test.tsx`)

22. Opens with title, email field, `SEND RESET LINK`; Escape, overlay click and close control each close it and return focus to the trigger.
23. Empty/malformed email -> inline error, no request.
24. Success -> form replaced by the generic message and `BACK TO SIGN IN`, which closes the dialog. Same UI for any success response.
25. Failure -> inline `Could not send the reset link. Please try again.`; form and email retained.
26. Dialog state resets after close/reopen.

Reset page (`reset-password-form.test.tsx`, `reset-password-content.test.tsx`)

27. Missing/empty `token` -> `This reset link is invalid or has expired.` with link to `/auth`; no request.
28. Field validation matches sign-up password rules; eye toggles work; error copy verbatim.
29. Success -> success toast `Password updated. Please sign in.`, local session discarded, `replace("/auth?mode=signin")`.
30. `400 INVALID_RESET_TOKEN` -> form replaced by invalid-link state.
31. Other failure -> inline `Could not reset your password. Please try again.`

Session / guard (`auth-provider.test.tsx`, `session-refresher.test.ts`, `token-store.test.ts`, `protected-route.test.tsx`, `guest-only-route.test.tsx`, `root-page.test.tsx`, `api-client.test.ts`)

32. On mount, exactly one `refreshSession` call even under React Strict Mode / concurrent callers (single-flight); `restoring` -> `authenticated` on success; `unauthenticated` on `401`, network error and `5xx` (no toast).
33. Access token is never written to `localStorage`/`sessionStorage` (spy on `Storage`), and is cleared on logout/clear.
34. Proactive renewal fires at `expiresIn - lead` (fake timers) and reschedules; failure clears the session.
35. Protected request `401 UNAUTHENTICATED` -> one refresh, one retry with the new bearer token; second `401` is returned (no loop); refresh failure -> `clearSession`. Public auth operations never trigger the retry.
36. Fetcher sends `credentials: "include"` and `Authorization` only when a token exists.
37. `ProtectedRoute`: `restoring` shows loader and neither children nor redirect; `unauthenticated` redirects to `/auth` and never renders children; `authenticated` renders children.
38. `GuestOnlyRoute`: authenticated -> redirect to `/dashboard`; restoring -> loader.
39. Root `/`: loader while restoring; then redirects to `/dashboard` or `/auth`.
40. Logout (dashboard placeholder): calls the operation, clears token, clears the query cache, navigates to `/auth`; when the call rejects the local session is still cleared.
41. Dashboard placeholder renders `Welcome, {name}` and a `Sign out` button.

UI primitives

42. `ToastProvider`: shows success/error, auto-dismisses after `TOAST_DURATION_MS`, manual dismiss, persists across a simulated route change.
43. `Button` loading state disables and exposes `aria-busy`.

### 10.2 End-to-end tests (Playwright, `e2e/auth.spec.ts`, real frontend + backend from `playwright.config.ts`)

Each test uses a unique email (timestamp/random) and its own browser context, so tests do not depend on one another.

1. Visit `/` unauthenticated -> lands on `/auth` with no protected-content flash.
2. Deep links: `/auth?mode=signup` shows Create Account; overlay button toggles views and updates the URL; browser Back returns to the previous view.
3. Sign up with valid data -> `/dashboard` shows the user's name; reload keeps the session (no `/auth` flash).
4. Sign up with the same email again (fresh context) -> toast `An account with this email already exists.`
5. Sign up inline validation (weak password, mismatch) -> messages shown, no navigation.
6. Sign in with valid credentials -> `/dashboard`; refresh cookie present as `HttpOnly` and no token in `localStorage`/`sessionStorage`.
7. Sign in with wrong password and with unknown email -> identical inline `Invalid email or password`.
8. Sign out from the placeholder -> `/auth`; going Back / visiting `/dashboard` redirects to `/auth`; the old refresh cookie no longer restores a session.
9. Authenticated visit to `/auth` -> redirected to `/dashboard`.
10. Access to `/dashboard` while unauthenticated -> `/auth`.
11. Forgot dialog: open, invalid email inline error, valid email -> generic message + `BACK TO SIGN IN`; Escape closes and focus returns to the link.
12. Reset page with missing token and with a bogus token -> invalid-link state (bogus token exercises `INVALID_RESET_TOKEN` against the real backend).
13. Reset form via mocked responses (`page.route` on the reset endpoint) for success (toast + redirect to `/auth?mode=signin`) and non-400 failure (inline error). A real end-to-end reset needs the raw token that only the backend console prints; that full-loop scenario is deferred to the Synthesizer's Integration section (e.g., a test-only way for Playwright to obtain the link) rather than assumed here.
14. Google: with `NEXT_PUBLIC_GOOGLE_CLIENT_ID` left unset in the Playwright frontend `webServer.env` (values for both `NEXT_PUBLIC_*` variables are passed explicitly there, independent of any developer `.env.local`), clicking the Google control shows `Google sign-in is unavailable.`; the real Google popup flow is not automated (covered by component tests 17-21).
15. Session expiry/renewal: force a `401 UNAUTHENTICATED` on a protected call via `page.route` and assert a single refresh + retry, and that a failed refresh returns the user to `/auth`. (Uses a protected call available after other features, or a route-mocked call from the placeholder page during this feature; if none exists in scope, covered by component test 35 only.)
16. Update `e2e/smoke.spec.ts`: the `/` page no longer renders an `h1` "Expense Tracker" (owned by the Test phase, not the Frontend Build).

### 10.3 Traceability

| Spec source                               | Tests                                      |
| :---------------------------------------- | :----------------------------------------- |
| REQ-AUTH-01 / behavior section 3          | 1-8 (incl. 3a), 14-16 (incl. 16a); E2E 2-5 |
| REQ-AUTH-02 / behavior section 4          | 9-13; E2E 6-7                              |
| REQ-AUTH-03 / behavior section 5          | 17-21 (incl. 21a); E2E 14                  |
| REQ-AUTH-04                               | 4, 28                                      |
| REQ-AUTH-05 / behavior section 6          | 22-31; E2E 11-13                           |
| REQ-AUTH-06 / behavior section 7          | 32-36, 40; E2E 3, 6, 8, 15                 |
| REQ-AUTH-07 / behavior section 8          | 37-41; E2E 1, 9, 10                        |
| FDS section 5 messages + generic feedback | 2-3, 7, 12, 25, 28, 31                     |

---

## 11. Build Sequencing and Boundaries (frontend only)

1. Tokens, fonts, `ui/*` primitives, toast provider, icons, logo.
2. `AuthCard` + brand panel + sign-in / sign-up forms, using contract schemas and the contract-built `api-client` over stubbed `fetch` (typed fixtures, section 8).
3. Forgot dialog, reset page, `GoogleAuthProvider` + Google button.
4. `token-store`, `session-refresher`, auth-aware fetcher on the `api-client`, `AuthProvider`, guards, root redirector, placeholder dashboard.
5. Component tests alongside each step.

Phase 6 (UI Review & Freeze, against the two visual PNGs) runs once, **after all frontend tasks above are complete** (matches `CLAUDE.md`: "after frontend build completes"); the forms only
contain the Google control and forgot-password trigger fully after step 3, so no earlier point is a valid freeze. If the developer wants an early look after step 2, that is an
informal preview and does NOT freeze the UI.

Boundaries: touch only `frontend/` and consume `packages/contracts` read-only. Do not modify `fds.md`, `behavior.md`, `visuals/`, `rules/`, `packages/contracts`, `backend/`, `e2e/`, the root `.env.example`, or the root `playwright.config.ts` (Integration/Test phases own those; `frontend/.env.example` is committed at Phase 0). Add only `@react-oauth/google`.
