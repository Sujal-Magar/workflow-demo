"use client";

import { useMutation } from "@tanstack/react-query";

import type { ForgotPasswordAck, ForgotPasswordRequest } from "@workflow-demo/contracts";

import { requestPasswordReset } from "../api/auth-api";
import type { AuthResult } from "../lib/auth-error";

export function useRequestPasswordReset(): {
  submitResetRequest: (values: ForgotPasswordRequest) => Promise<AuthResult<ForgotPasswordAck>>;
  isPending: boolean;
} {
  const { mutateAsync, isPending } = useMutation({ mutationFn: requestPasswordReset });
  return { submitResetRequest: mutateAsync, isPending };
}
