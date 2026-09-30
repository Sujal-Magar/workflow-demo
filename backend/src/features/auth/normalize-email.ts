/** Emails are stored and looked up in lowercase (FDS §3). Trimming is done by the shared rules. */
export function normalizeEmail(email: string): string {
  return email.toLowerCase();
}
