import { NAME_MIN_LENGTH } from "@workflow-demo/contracts";

import { GOOGLE_FALLBACK_NAME } from "./auth-constants";

/**
 * Display name for a new Google account (REQ-AUTH-03): the trimmed `name` claim if it has at least
 * 2 characters, else the email's local part if it has at least 2 characters, else "User".
 */
export function resolveGoogleName(nameClaim: string | null, email: string): string {
  const trimmedName = nameClaim?.trim() ?? "";
  if (trimmedName.length >= NAME_MIN_LENGTH) {
    return trimmedName;
  }
  const atIndex = email.indexOf("@");
  const localPart = atIndex === -1 ? email : email.slice(0, atIndex);
  if (localPart.length >= NAME_MIN_LENGTH) {
    return localPart;
  }
  return GOOGLE_FALLBACK_NAME;
}
