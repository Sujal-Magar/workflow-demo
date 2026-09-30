"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { login } from "../api/auth-api";
import type { AuthFailure } from "../lib/auth-error";
import type { SignInRequest } from "../mocks/auth-types.mock";
import { useAuth } from "../session/use-auth";

/** Resolves `null` after establishing the session and navigating, or the failure for the form to present. */
export function useSignIn(): {
  submitSignIn: (values: SignInRequest) => Promise<AuthFailure | null>;
  isPending: boolean;
} {
  const router = useRouter();
  const { establishSession } = useAuth();
  const { mutateAsync, isPending } = useMutation({ mutationFn: login });

  const submitSignIn = useCallback(
    async (values: SignInRequest): Promise<AuthFailure | null> => {
      const result = await mutateAsync(values);
      if (!result.ok) {
        return result.failure;
      }
      establishSession(result.data);
      router.replace("/dashboard");
      return null;
    },
    [establishSession, mutateAsync, router]
  );

  return { submitSignIn, isPending };
}
