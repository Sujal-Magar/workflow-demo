/** Named constants for the auth feature (plan §4). Every module reads them from here. */

export const ACCESS_TOKEN_LIFETIME_SECONDS = 900;
export const REFRESH_TOKEN_LIFETIME_SECONDS = 604_800;
export const RESET_TOKEN_LIFETIME_MINUTES = 30;
export const OPAQUE_TOKEN_BYTES = 32;

export const REFRESH_COOKIE_NAME = "refresh_token";
export const REFRESH_COOKIE_PATH = "/api/v1/auth";

export const FORGOT_PASSWORD_ACK_MESSAGE = "If an account exists for that email, a reset link has been sent.";
export const RESET_PASSWORD_PAGE_PATH = "/reset-password";

export const GOOGLE_FALLBACK_NAME = "User";

export const MILLISECONDS_PER_SECOND = 1000;
export const MILLISECONDS_PER_MINUTE = 60_000;
