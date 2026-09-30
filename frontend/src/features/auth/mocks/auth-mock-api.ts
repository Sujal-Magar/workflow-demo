// Phase 5 in-memory stand-in for the auth API (plan FE-05), answering with the statuses and bodies of
// contract.md §6. State lives in module memory only, never Web Storage. Deleted in INT-05.
import type { ZodType } from "zod";

import {
  forgotPasswordRequestSchema,
  googleSignInRequestSchema,
  resetPasswordRequestSchema,
  signInRequestSchema,
  signUpRequestSchema,
} from "./auth-form-schemas.mock";
import {
  createSeedAccounts,
  MOCK_ACCESS_TOKEN_LIFETIME_SECONDS,
  MOCK_BAD_GOOGLE_CREDENTIAL,
  MOCK_FORGOT_PASSWORD_MESSAGE,
  MOCK_LATENCY_MS,
  MOCK_NETWORK_FAILURE_MARKER,
  MOCK_VALID_RESET_TOKEN,
  type MockAccount,
} from "./auth-mock-data";
import { AUTH_ERROR_CODES, type AuthErrorCode, type ErrorBody, type PublicUser } from "./auth-types.mock";

export interface MockResponse {
  readonly status: number;
  readonly body: unknown;
}

/** Thrown to simulate a request that never got a response (the fetch rejected). */
export class MockNetworkError extends Error {
  constructor(operation: string) {
    super(`Simulated network failure for mock ${operation}`);
    this.name = "MockNetworkError";
  }
}

const ERROR_MESSAGES: Readonly<Record<AuthErrorCode, string>> = {
  VALIDATION_ERROR: "Request validation failed.",
  INVALID_RESET_TOKEN: "This reset link is invalid or has expired.",
  INVALID_CREDENTIALS: "Invalid email or password.",
  INVALID_GOOGLE_TOKEN: "Google sign-in failed.",
  UNAUTHENTICATED: "Authentication required.",
  EMAIL_ALREADY_EXISTS: "An account with this email already exists.",
  NOT_FOUND: "Route not found.",
  INTERNAL_ERROR: "An unexpected error occurred.",
};

const accounts: MockAccount[] = createSeedAccounts();
let sessionUser: PublicUser | null = null;
let currentAccessToken: string | null = null;
let issuedTokenCount = 0;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorResponse(status: number, code: AuthErrorCode, fieldErrors?: Record<string, string>): MockResponse {
  const body: ErrorBody = { code, message: ERROR_MESSAGES[code] };
  return { status, body: fieldErrors ? { ...body, fieldErrors } : body };
}

/** Mirrors the server: absent or non-string fields count as empty; first failing rule per field. */
function validateBody<T>(
  schema: ZodType<T>,
  body: unknown,
  fields: readonly string[]
): { ok: true; data: T } | { ok: false; response: MockResponse } {
  const source: Record<string, unknown> = typeof body === "object" && body !== null ? { ...body } : {};
  const normalized: Record<string, string> = {};
  for (const field of fields) {
    const value = source[field];
    normalized[field] = typeof value === "string" ? value : "";
  }
  const parsed = schema.safeParse(normalized);
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? "");
    if (field && !(field in fieldErrors)) {
      fieldErrors[field] = issue.message;
    }
  }
  return { ok: false, response: errorResponse(400, AUTH_ERROR_CODES.VALIDATION_ERROR, fieldErrors) };
}

function assertReachable(operation: string, email?: string): void {
  if (email?.includes(MOCK_NETWORK_FAILURE_MARKER)) {
    throw new MockNetworkError(operation);
  }
}

function findAccountByEmail(email: string): MockAccount | undefined {
  const normalizedEmail = email.toLowerCase();
  return accounts.find((account) => account.user.email === normalizedEmail);
}

function startSession(user: PublicUser, status: number): MockResponse {
  issuedTokenCount += 1;
  sessionUser = user;
  currentAccessToken = `mock-access-token-${issuedTokenCount}`;
  return {
    status,
    body: { user, accessToken: currentAccessToken, expiresIn: MOCK_ACCESS_TOKEN_LIFETIME_SECONDS },
  };
}

function endSession(): void {
  sessionUser = null;
  currentAccessToken = null;
}

export async function mockRegister(body: unknown): Promise<MockResponse> {
  await delay(MOCK_LATENCY_MS);
  const validation = validateBody(signUpRequestSchema, body, ["name", "email", "password", "confirmPassword"]);
  if (!validation.ok) {
    return validation.response;
  }
  const { name, email, password } = validation.data;
  assertReachable("register", email);
  if (findAccountByEmail(email)) {
    return errorResponse(409, AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS);
  }
  const user: PublicUser = { id: crypto.randomUUID(), name, email: email.toLowerCase() };
  accounts.push({ user, password });
  return startSession(user, 201);
}

export async function mockLogin(body: unknown): Promise<MockResponse> {
  await delay(MOCK_LATENCY_MS);
  const validation = validateBody(signInRequestSchema, body, ["email", "password"]);
  if (!validation.ok) {
    return validation.response;
  }
  const { email, password } = validation.data;
  assertReachable("login", email);
  const account = findAccountByEmail(email);
  if (!account || account.password === null || account.password !== password) {
    return errorResponse(401, AUTH_ERROR_CODES.INVALID_CREDENTIALS);
  }
  return startSession(account.user, 200);
}

export async function mockGoogleOAuthLogin(body: unknown): Promise<MockResponse> {
  await delay(MOCK_LATENCY_MS);
  const validation = validateBody(googleSignInRequestSchema, body, ["token"]);
  if (!validation.ok) {
    return validation.response;
  }
  if (validation.data.token === MOCK_BAD_GOOGLE_CREDENTIAL) {
    return errorResponse(401, AUTH_ERROR_CODES.INVALID_GOOGLE_TOKEN);
  }
  const googleAccount = findAccountByEmail("gia@example.com");
  if (!googleAccount) {
    return errorResponse(500, AUTH_ERROR_CODES.INTERNAL_ERROR);
  }
  return startSession(googleAccount.user, 200);
}

export async function mockRefreshSession(): Promise<MockResponse> {
  await delay(MOCK_LATENCY_MS);
  if (!sessionUser) {
    return errorResponse(401, AUTH_ERROR_CODES.UNAUTHENTICATED);
  }
  return startSession(sessionUser, 200);
}

export async function mockGetCurrentUser(accessToken: string | null): Promise<MockResponse> {
  await delay(MOCK_LATENCY_MS);
  if (!sessionUser || !accessToken || accessToken !== currentAccessToken) {
    return errorResponse(401, AUTH_ERROR_CODES.UNAUTHENTICATED);
  }
  return { status: 200, body: { user: sessionUser } };
}

export async function mockLogout(): Promise<MockResponse> {
  await delay(MOCK_LATENCY_MS);
  endSession();
  return { status: 200, body: { success: true } };
}

export async function mockRequestPasswordReset(body: unknown): Promise<MockResponse> {
  await delay(MOCK_LATENCY_MS);
  const validation = validateBody(forgotPasswordRequestSchema, body, ["email"]);
  if (!validation.ok) {
    return validation.response;
  }
  assertReachable("requestPasswordReset", validation.data.email);
  return { status: 200, body: { success: true, message: MOCK_FORGOT_PASSWORD_MESSAGE } };
}

export async function mockResetPassword(body: unknown): Promise<MockResponse> {
  await delay(MOCK_LATENCY_MS);
  const validation = validateBody(resetPasswordRequestSchema, body, ["token", "password", "confirmPassword"]);
  if (!validation.ok) {
    return validation.response;
  }
  if (validation.data.token !== MOCK_VALID_RESET_TOKEN) {
    return errorResponse(400, AUTH_ERROR_CODES.INVALID_RESET_TOKEN);
  }
  // A successful reset revokes every refresh token, so the mock session ends too.
  endSession();
  return { status: 200, body: { success: true } };
}
