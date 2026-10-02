"use client";

import { useMutation } from "@tanstack/react-query";

import { changePassword } from "../api/profile-api";
import type { ProfileResult } from "../lib/profile-error";
import type { ChangePasswordRequest, ProfileSuccessAck } from "@workflow-demo/contracts";

export function useChangePassword(): {
  submitChangePassword: (values: ChangePasswordRequest) => Promise<ProfileResult<ProfileSuccessAck>>;
  isPending: boolean;
} {
  const { mutateAsync, isPending } = useMutation({ mutationFn: changePassword });
  return { submitChangePassword: mutateAsync, isPending };
}
