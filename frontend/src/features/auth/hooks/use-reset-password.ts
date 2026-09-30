"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";

import { useToast } from "@/components/ui/toast";

import { resetPassword } from "../api/auth-api";
import { PASSWORD_UPDATED_TOAST } from "../lib/auth-copy";
import type { AuthFailure } from "../lib/auth-error";
import type { NewPasswordFields } from "../mocks/auth-types.mock";
import { useAuth } from "../session/use-auth";

/**
 * Merges the URL token into the request. On success the local session is cleared (not `logout()`: the server has
 * already revoked every refresh token), then the toast shows and the visitor lands on the sign-in form (D-12).
 */
export function useResetPassword(token: string): {
  submitNewPassword: (values: NewPasswordFields) => Promise<AuthFailure | null>;
  isPending: boolean;
} {
  const router = useRouter();
  const toast = useToast();
  const { clearSession } = useAuth();
  const { mutateAsync, isPending } = useMutation({ mutationFn: resetPassword });

  const submitNewPassword = useCallback(
    async (values: NewPasswordFields): Promise<AuthFailure | null> => {
      const result = await mutateAsync({ token, ...values });
      if (!result.ok) {
        return result.failure;
      }
      clearSession();
      toast.success(PASSWORD_UPDATED_TOAST);
      router.replace("/auth?mode=signin");
      return null;
    },
    [clearSession, mutateAsync, router, toast, token]
  );

  return { submitNewPassword, isPending };
}
