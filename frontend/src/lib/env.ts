const DEFAULT_API_BASE_URL = "http://localhost:4000";

export interface ClientEnv {
  readonly apiBaseUrl: string;
  /** `null` when unset or empty: Google sign-in is then unavailable. */
  readonly googleClientId: string | null;
}

// Each variable is read by direct `process.env.NEXT_PUBLIC_…` property access, the only form Next inlines
// into the client bundle.
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export const env: ClientEnv = {
  apiBaseUrl: apiBaseUrl ? apiBaseUrl : DEFAULT_API_BASE_URL,
  googleClientId: googleClientId ? googleClientId : null,
};
