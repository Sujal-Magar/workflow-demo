// The ts-rest client for the API (plan INT-02, D-23). Every request goes through `authAwareFetcher`. This module
// imports nothing from `features/`: the session layer reaches it only through `registerSessionHandlers`.
import { tsRestFetchApi, type ApiFetcherArgs, type AppRoute } from "@ts-rest/core";
import { initTsrReactQuery } from "@ts-rest/react-query/v5";

import { authContract, ERROR_CODES, errorBodySchema } from "@workflow-demo/contracts";

import { getAccessToken } from "./access-token-store";
import { env } from "./env";

const HTTP_UNAUTHORIZED = 401;

export interface SessionHandlers {
  /** Single-flight refresh: `true` once the renewed token is in the store, `false` when the refresh failed. */
  readonly refreshSession: () => Promise<boolean>;
  /** The one "session is gone" path: clears the local session and redirects to `/auth`. */
  readonly onSessionExpired: () => void;
}

type FetcherResponse = Awaited<ReturnType<typeof tsRestFetchApi>>;

/**
 * Public and cookie operations (contract §7): a 401 on these is an answer for the caller, never a reason to refresh.
 * Every other route, including every later feature's operations, is protected.
 */
const UNRETRIED_ROUTES: ReadonlySet<AppRoute> = new Set<AppRoute>([
  authContract.register,
  authContract.login,
  authContract.googleOAuthLogin,
  authContract.refreshSession,
  authContract.logout,
  authContract.requestPasswordReset,
  authContract.resetPassword,
]);

let sessionHandlers: SessionHandlers | null = null;

/**
 * Registers the session layer's handlers and returns the function that unregisters them. Unregistering only clears
 * the handlers it registered, so a stale cleanup (for example from StrictMode's double mount) never removes newer ones.
 */
export function registerSessionHandlers(handlers: SessionHandlers): () => void {
  sessionHandlers = handlers;
  return () => {
    if (sessionHandlers === handlers) {
      sessionHandlers = null;
    }
  };
}

function isUnauthenticatedResponse(response: FetcherResponse): boolean {
  if (response.status !== HTTP_UNAUTHORIZED) {
    return false;
  }
  const parsedBody = errorBodySchema.safeParse(response.body);
  return parsedBody.success && parsedBody.data.code === ERROR_CODES.UNAUTHENTICATED;
}

/** Sends the request with credentials included and, when the store holds one, the current access token. */
function sendWithSession(args: ApiFetcherArgs): Promise<FetcherResponse> {
  const accessToken = getAccessToken();
  const headers = accessToken ? { ...args.headers, authorization: `Bearer ${accessToken}` } : args.headers;
  return tsRestFetchApi({
    ...args,
    headers,
    fetchOptions: { ...args.fetchOptions, credentials: "include" },
  });
}

/**
 * A protected `401 UNAUTHENTICATED` triggers one refresh and one retry (contract §7). If the refresh fails or the
 * retry is also a 401, the session has expired and that 401 is returned. Without registered handlers the 401 is
 * returned unchanged.
 */
async function authAwareFetcher(args: ApiFetcherArgs): Promise<FetcherResponse> {
  const response = await sendWithSession(args);
  const handlers = sessionHandlers;
  if (!handlers || UNRETRIED_ROUTES.has(args.route) || !isUnauthenticatedResponse(response)) {
    return response;
  }
  const isRefreshed = await handlers.refreshSession();
  if (!isRefreshed) {
    handlers.onSessionExpired();
    return response;
  }
  const retryResponse = await sendWithSession(args);
  if (isUnauthenticatedResponse(retryResponse)) {
    handlers.onSessionExpired();
  }
  return retryResponse;
}

/** Base URL is the API origin only: the contract's routes already carry `/api/v1/auth` (BE-03). */
export const authApiClient = initTsrReactQuery(authContract, {
  baseUrl: env.apiBaseUrl,
  baseHeaders: {},
  credentials: "include",
  api: authAwareFetcher,
});
