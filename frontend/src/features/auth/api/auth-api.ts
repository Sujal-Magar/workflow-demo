// The single module through which every auth hook and the session layer reach the API (plan FE-05).
// Phase 5: backed by the in-memory mock. INT-03 replaces the calls with the ts-rest client; the exported
// signatures and the result mapping stay the same.
import type { ZodType } from "zod";

import { getAccessToken } from "@/lib/access-token-store";

import { toAuthFailure, type AuthOperation, type AuthResult } from "../lib/auth-error";
import {
  mockGetCurrentUser,
  mockGoogleOAuthLogin,
  mockLogin,
  mockLogout,
  mockRefreshSession,
  mockRegister,
  mockRequestPasswordReset,
  mockResetPassword,
  type MockResponse,
} from "../mocks/auth-mock-api";
import {
  currentUserResponseSchema,
  forgotPasswordAckSchema,
  sessionPayloadSchema,
  successAckSchema,
  type CurrentUserResponse,
  type ForgotPasswordAck,
  type ForgotPasswordRequest,
  type GoogleSignInRequest,
  type ResetPasswordRequest,
  type SessionPayload,
  type SignInRequest,
  type SignUpRequest,
  type SuccessAck,
} from "../mocks/auth-types.mock";

const HTTP_OK = 200;
const HTTP_CREATED = 201;

interface OperationSpec<T> {
  readonly operation: AuthOperation;
  readonly successStatus: number;
  readonly successSchema: ZodType<T>;
}

async function runOperation<T>(spec: OperationSpec<T>, send: () => Promise<MockResponse>): Promise<AuthResult<T>> {
  let response: MockResponse;
  try {
    response = await send();
  } catch {
    // No response at all (network failure): the caller applies the generic failure feedback.
    return { ok: false, failure: toAuthFailure(spec.operation, { kind: "network-error" }) };
  }
  if (response.status === spec.successStatus) {
    const parsed = spec.successSchema.safeParse(response.body);
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false, failure: { kind: "unexpected" } };
  }
  return {
    ok: false,
    failure: toAuthFailure(spec.operation, { kind: "response", status: response.status, body: response.body }),
  };
}

export function register(body: SignUpRequest): Promise<AuthResult<SessionPayload>> {
  return runOperation({ operation: "register", successStatus: HTTP_CREATED, successSchema: sessionPayloadSchema }, () =>
    mockRegister(body)
  );
}

export function login(body: SignInRequest): Promise<AuthResult<SessionPayload>> {
  return runOperation({ operation: "login", successStatus: HTTP_OK, successSchema: sessionPayloadSchema }, () =>
    mockLogin(body)
  );
}

export function googleOAuthLogin(body: GoogleSignInRequest): Promise<AuthResult<SessionPayload>> {
  return runOperation(
    { operation: "googleOAuthLogin", successStatus: HTTP_OK, successSchema: sessionPayloadSchema },
    () => mockGoogleOAuthLogin(body)
  );
}

export function refreshSession(): Promise<AuthResult<SessionPayload>> {
  return runOperation(
    { operation: "refreshSession", successStatus: HTTP_OK, successSchema: sessionPayloadSchema },
    () => mockRefreshSession()
  );
}

export function getCurrentUser(): Promise<AuthResult<CurrentUserResponse>> {
  return runOperation(
    { operation: "getCurrentUser", successStatus: HTTP_OK, successSchema: currentUserResponseSchema },
    () => mockGetCurrentUser(getAccessToken())
  );
}

export function logout(): Promise<AuthResult<SuccessAck>> {
  return runOperation({ operation: "logout", successStatus: HTTP_OK, successSchema: successAckSchema }, () =>
    mockLogout()
  );
}

export function requestPasswordReset(body: ForgotPasswordRequest): Promise<AuthResult<ForgotPasswordAck>> {
  return runOperation(
    { operation: "requestPasswordReset", successStatus: HTTP_OK, successSchema: forgotPasswordAckSchema },
    () => mockRequestPasswordReset(body)
  );
}

export function resetPassword(body: ResetPasswordRequest): Promise<AuthResult<SuccessAck>> {
  return runOperation({ operation: "resetPassword", successStatus: HTTP_OK, successSchema: successAckSchema }, () =>
    mockResetPassword(body)
  );
}
