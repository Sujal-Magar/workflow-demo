import type { CookieOptions, Request, Response } from "express";

import {
  MILLISECONDS_PER_SECOND,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_LIFETIME_SECONDS,
} from "./auth-constants";

/** Contract §4 attributes; `Secure` only when the server runs in production. */
function refreshCookieOptions(isSecure: boolean, maxAgeSeconds: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    secure: isSecure,
    // Express takes milliseconds and writes `Max-Age` in seconds.
    maxAge: maxAgeSeconds * MILLISECONDS_PER_SECOND,
  };
}

export function setRefreshCookie(response: Response, refreshToken: string, isSecure: boolean): void {
  response.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions(isSecure, REFRESH_TOKEN_LIFETIME_SECONDS));
}

/** Same name, path and flags with `Max-Age=0`. */
export function clearRefreshCookie(response: Response, isSecure: boolean): void {
  response.cookie(REFRESH_COOKIE_NAME, "", refreshCookieOptions(isSecure, 0));
}

export function readRefreshCookie(request: Request): string | undefined {
  // cookie-parser types `cookies` loosely; treat the value as unknown and narrow it.
  const value: unknown = request.cookies?.[REFRESH_COOKIE_NAME];
  return typeof value === "string" && value !== "" ? value : undefined;
}
