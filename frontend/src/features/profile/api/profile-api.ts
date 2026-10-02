// The single module through which every profile hook reaches the API (plan FE-08).
// Switched to the real ts-rest client in Integration (plan INT-01); hook signatures and callers do not change.
import type { ZodType } from "zod";

import {
  profileSuccessAckSchema,
  userProfileSchema,
  type ChangePasswordRequest,
  type ClearAllUserDataRequest,
  type ProfileSuccessAck,
  type UpdateUserProfileRequest,
  type UserProfile,
} from "@workflow-demo/contracts";

import { profileApiClient } from "@/lib/api-client";

import { toProfileFailure, type ProfileOperation, type ProfileResult } from "../lib/profile-error";

const HTTP_OK = 200;

interface RawResponse {
  readonly status: number;
  readonly body: unknown;
}

interface OperationSpec<T> {
  readonly operation: ProfileOperation;
  readonly successStatus: number;
  readonly successSchema: ZodType<T>;
}

async function runOperation<T>(spec: OperationSpec<T>, send: () => Promise<RawResponse>): Promise<ProfileResult<T>> {
  let response: RawResponse;
  try {
    response = await send();
  } catch {
    // No response at all (network failure): the caller applies the generic failure feedback.
    return { ok: false, failure: toProfileFailure(spec.operation, { kind: "network-error" }) };
  }
  if (response.status === spec.successStatus) {
    const parsed = spec.successSchema.safeParse(response.body);
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false, failure: { kind: "unexpected" } };
  }
  return {
    ok: false,
    failure: toProfileFailure(spec.operation, { kind: "response", status: response.status, body: response.body }),
  };
}

export function getProfile(): Promise<ProfileResult<UserProfile>> {
  return runOperation({ operation: "getProfile", successStatus: HTTP_OK, successSchema: userProfileSchema }, () =>
    profileApiClient.getUserProfile.query()
  );
}

export function updateProfile(body: UpdateUserProfileRequest): Promise<ProfileResult<UserProfile>> {
  return runOperation({ operation: "updateProfile", successStatus: HTTP_OK, successSchema: userProfileSchema }, () =>
    profileApiClient.updateUserProfile.mutate({ body })
  );
}

export function changePassword(body: ChangePasswordRequest): Promise<ProfileResult<ProfileSuccessAck>> {
  return runOperation(
    { operation: "changePassword", successStatus: HTTP_OK, successSchema: profileSuccessAckSchema },
    () => profileApiClient.changePassword.mutate({ body })
  );
}

export function exportData(): Promise<ProfileResult<UserProfile>> {
  return runOperation({ operation: "exportData", successStatus: HTTP_OK, successSchema: userProfileSchema }, () =>
    profileApiClient.exportUserData.query()
  );
}

export function clearAllData(body: ClearAllUserDataRequest): Promise<ProfileResult<ProfileSuccessAck>> {
  return runOperation(
    { operation: "clearAllData", successStatus: HTTP_OK, successSchema: profileSuccessAckSchema },
    () => profileApiClient.clearAllUserData.mutate({ body })
  );
}
