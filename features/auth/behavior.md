# Behavior Specification: Authentication and Identity

## 1. Routes

- `/auth` is the single route for both Sign In and Sign Up. The active view is driven by the `mode` query parameter: `/auth?mode=signin` (default when absent or unrecognized) and `/auth?mode=signup`.
- `/reset-password?token=<token>` is the password reset confirmation route.
- Switching panels updates `mode` in the URL without a full page reload, so each view is deep-linkable and works with the browser back button.

## 2. Sliding Panel Navigation & Transitions

- The authentication module presents a unified dual-state card with smooth CSS transitions:
  - **State 1 (Sign Up View, `mode=signup`)**:
    - Left emerald panel shows welcome message and `"SIGN IN"` button.
    - Right form area displays registration inputs.
    - Clicking `"SIGN IN"` triggers a sliding animation shifting the colored panel to the right, revealing State 2.
  - **State 2 (Sign In View, `mode=signin`)**:
    - Left form area displays login inputs.
    - Right emerald panel shows invitation copy and `"SIGN UP"` button.
    - Clicking `"SIGN UP"` reverses the sliding animation back to State 1.
- The panel toggle buttons are solid teal, matching the visual references.
- Field values and inline errors of the hidden view are cleared when switching views.

## 3. Registration (Sign Up) Workflow

1. User enters their Name, Email, Password, and Confirm Password into the form.
2. Clicking the trailing eye icon toggles mask visibility on password values.
3. User clicks **"SIGN UP"**:
   - If fields are empty, invalid, or passwords do not match: Form indicates invalid fields inline and no request is sent.
   - While the request is in flight: the button is disabled and shows a loading state.
   - If registration succeeds: Authenticates user, establishes the session (refresh cookie plus in-memory access token), and navigates immediately to `/dashboard`.
   - If email is already in use (`409 EMAIL_ALREADY_EXISTS`): Surfaces an error toast: `"An account with this email already exists."`
   - If the request fails for any other reason: Surfaces an error toast: `"Could not create your account. Please try again."`
4. Alternatively, the user uses the Google button (section 5).

## 4. Login (Sign In) Workflow

1. User inputs their registered Email and Password.
2. User clicks **"SIGN IN"**:
   - Empty or malformed fields are flagged inline and no request is sent.
   - While the request is in flight: the button is disabled and shows a loading state.
   - If invalid (`401 INVALID_CREDENTIALS`): Displays inline error `"Invalid email or password"` and shakes the credential input boxes. The same message is shown for an unknown email, a wrong password, and a Google-only account.
   - If valid: Persists session, sets user state, and redirects to `/dashboard`.
3. Clicking **"Forgot your password?"** opens the password reset request dialog (section 6).

## 5. Google Sign-In Workflow

1. The Google icon button appears on both the Sign Up and Sign In panels.
2. User clicks it and Google's popup opens.
   - If the user closes or dismisses the popup: nothing happens. No toast, no error, the form is unchanged.
   - If the Google script cannot load or `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is not configured: error toast `"Google sign-in is unavailable."`
3. If the user completes the popup, the returned ID token is sent to the backend:
   - Success (new account, existing Google account, or existing email account that is now linked): establishes the session and redirects to `/dashboard`.
   - Rejected token (`401 INVALID_GOOGLE_TOKEN`): error toast `"Google sign-in failed. Please try again."`

## 6. Forgot Password Workflow

### Request dialog

1. The dialog opens over the auth card, titled `"Reset your password"`, with an email field and a `"SEND RESET LINK"` button. The dialog closes on Escape, on outside click, and via a close control; focus returns to the `"Forgot your password?"` link.
2. If the email is empty or malformed: inline error, no request sent.
3. On submit: the button is disabled with a loading state, then the dialog shows the generic message `"If an account exists for that email, a reset link has been sent."` and a `"BACK TO SIGN IN"` button that closes the dialog. This message is shown whether or not the email is registered.
4. If the request itself fails (network or server error): inline error `"Could not send the reset link. Please try again."` and the form stays open.
5. In development the reset URL is printed to the backend console; no email is sent.

### Reset page (`/reset-password?token=<token>`)

1. If `token` is missing: show `"This reset link is invalid or has expired."` with a link to `/auth`; no request is sent.
2. Otherwise show **New Password** and **Confirm New Password** fields with eye toggles and a `"RESET PASSWORD"` button. Validation matches the sign-up password rules; errors are inline.
3. On success: redirect to `/auth?mode=signin` with the success toast `"Password updated. Please sign in."` The user is not signed in automatically, and other sessions are ended.
4. On `400 INVALID_RESET_TOKEN`: replace the form with `"This reset link is invalid or has expired."` and a link to `/auth`.

## 7. Session Restore, Renewal & Logout

- **On application load**, the app calls `refreshSession` before deciding what to render:
  - Success: the user is signed in and the access token is held in memory.
  - `401`: the user is unauthenticated.
- **Renewal**: the access token is renewed shortly before it expires. If a protected request returns `401 UNAUTHENTICATED`, the app refreshes once and retries the request once. If the refresh fails, the session is cleared and the user is redirected to `/auth`.
- **Logout**: calls `logout`, discards the in-memory access token, clears cached server state, and redirects to `/auth`. If the `logout` call fails, the local session is still cleared.
- The access token is never written to `localStorage` or `sessionStorage`.

## 8. Protected Route & Session Handling

- The guard runs client-side in the protected layout.
- While session restore is pending, protected routes show a loading state, not protected content and not a redirect.
- Unauthenticated access to `/dashboard`, `/transactions`, `/budget`, `/goals`, `/reports`, or `/profile` redirects to `/auth`.
- An authenticated user opening `/auth` is redirected to `/dashboard`.
- The session persists across reloads until explicit logout, password reset, or refresh-token expiry (7 days from the last refresh).
