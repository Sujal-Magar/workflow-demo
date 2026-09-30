// User-facing copy for auth (plan §5.2). Field validation messages live in the shared rule sets, not here.

export const SIGN_IN_TITLE = "Sign in to FinTrack";
export const SIGN_IN_DIVIDER = "or use your account";
export const SIGN_UP_TITLE = "Create Account";
export const SIGN_UP_DIVIDER = "or use your email for registration";

export const SIGN_IN_INVITE_HEADING = "Hello, Friend!";
export const SIGN_IN_INVITE_TEXT = "Enter your personal details and start journey with us";
export const SIGN_UP_INVITE_HEADING = "Welcome Back!";
export const SIGN_UP_INVITE_TEXT = "Log in to manage your finances.";

export const SIGN_IN_BUTTON = "SIGN IN";
export const SIGN_UP_BUTTON = "SIGN UP";
export const SEND_RESET_LINK_BUTTON = "SEND RESET LINK";
export const BACK_TO_SIGN_IN_BUTTON = "BACK TO SIGN IN";
export const RESET_PASSWORD_BUTTON = "RESET PASSWORD";
export const SIGN_OUT_BUTTON = "Sign out";

export const FORGOT_PASSWORD_LINK = "Forgot your password?";
export const RESET_DIALOG_TITLE = "Reset your password";
/** Heading of the `/reset-password` card; reuses the dialog title wording. */
export const RESET_PAGE_TITLE = RESET_DIALOG_TITLE;
export const RESET_DIALOG_DESCRIPTION = "Enter your account email and we will send you a link to reset your password.";
export const RESET_REQUEST_SENT = "If an account exists for that email, a reset link has been sent.";

export const INVALID_CREDENTIALS = "Invalid email or password";
export const EMAIL_EXISTS_TOAST = "An account with this email already exists.";
export const SIGN_UP_FAILED_TOAST = "Could not create your account. Please try again.";
export const SIGN_IN_FAILED_TOAST = "Could not sign in. Please try again.";
export const GOOGLE_UNAVAILABLE_TOAST = "Google sign-in is unavailable.";
export const GOOGLE_FAILED_TOAST = "Google sign-in failed. Please try again.";
export const GOOGLE_BUTTON_LABEL = "Sign in with Google";
export const RESET_REQUEST_FAILED = "Could not send the reset link. Please try again.";
export const RESET_FAILED = "Could not reset your password. Please try again.";
export const RESET_LINK_INVALID = "This reset link is invalid or has expired.";
export const PASSWORD_UPDATED_TOAST = "Password updated. Please sign in.";

export const NAME_PLACEHOLDER = "Name";
export const EMAIL_PLACEHOLDER = "Email";
export const PASSWORD_PLACEHOLDER = "Password";
export const CONFIRM_PASSWORD_PLACEHOLDER = "Confirm Password";
export const NEW_PASSWORD_PLACEHOLDER = "New Password";
export const CONFIRM_NEW_PASSWORD_PLACEHOLDER = "Confirm New Password";

export const LOGO_TAGLINE = "Track smarter. Save better.";

export function signedInAs(name: string): string {
  return `Signed in as ${name}`;
}
