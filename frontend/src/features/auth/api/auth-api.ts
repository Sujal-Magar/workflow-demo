// The single module through which every auth hook and the session layer reach the API (plan FE-05, INT-03).
// Each call goes through the ts-rest client, and each response is mapped to the result union by declared status and
// `code` (contract §6, §7).
import type { ZodType } from "zod";

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
} from "@workflow-demo/contracts";

import { authApiClient } from "@/lib/api-client";

import { toAuthFailure, type AuthOperation, type AuthResult } from "../lib/auth-error";

const HTTP_OK = 200;
const HTTP_CREATED = 201;

interface RawResponse {
  readonly status: number;
  readonly body: unknown;
}

interface OperationSpec<T> {
  readonly operation: AuthOperation;
  readonly successStatus: number;
  readonly successSchema: ZodType<T>;
}

async function runOperation<T>(spec: OperationSpec<T>, send: () => Promise<RawResponse>): Promise<AuthResult<T>> {
  let response: RawResponse;
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
    authApiClient.register.mutate({ body })
  );
}

export function login(body: SignInRequest): Promise<AuthResult<SessionPayload>> {
  return runOperation({ operation: "login", successStatus: HTTP_OK, successSchema: sessionPayloadSchema }, () =>
    authApiClient.login.mutate({ body })
  );
}

export function googleOAuthLogin(body: GoogleSignInRequest): Promise<AuthResult<SessionPayload>> {
  return runOperation(
    { operation: "googleOAuthLogin", successStatus: HTTP_OK, successSchema: sessionPayloadSchema },
    () => authApiClient.googleOAuthLogin.mutate({ body })
  );
}

export function refreshSession(): Promise<AuthResult<SessionPayload>> {
  return runOperation(
    { operation: "refreshSession", successStatus: HTTP_OK, successSchema: sessionPayloadSchema },
    () => authApiClient.refreshSession.mutate()
  );
}

export function getCurrentUser(): Promise<AuthResult<CurrentUserResponse>> {
  return runOperation(
    { operation: "getCurrentUser", successStatus: HTTP_OK, successSchema: currentUserResponseSchema },
    () => authApiClient.getCurrentUser.query()
  );
}

export function logout(): Promise<AuthResult<SuccessAck>> {
  return runOperation({ operation: "logout", successStatus: HTTP_OK, successSchema: successAckSchema }, () =>
    authApiClient.logout.mutate()
  );
}

export function requestPasswordReset(body: ForgotPasswordRequest): Promise<AuthResult<ForgotPasswordAck>> {
  return runOperation(
    { operation: "requestPasswordReset", successStatus: HTTP_OK, successSchema: forgotPasswordAckSchema },
    () => authApiClient.requestPasswordReset.mutate({ body })
  );
}

export function resetPassword(body: ResetPasswordRequest): Promise<AuthResult<SuccessAck>> {
  return runOperation({ operation: "resetPassword", successStatus: HTTP_OK, successSchema: successAckSchema }, () =>
    authApiClient.resetPassword.mutate({ body })
  );
}
