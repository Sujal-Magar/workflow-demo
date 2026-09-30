"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { register } from "../api/auth-api";
import type { AuthFailure } from "../lib/auth-error";
import type { SignUpRequest } from "../mocks/auth-types.mock";
import { useAuth } from "../session/use-auth";

/** Resolves `null` after establishing the session and navigating, or the failure for the form to present. */
export function useSignUp(): {
  submitSignUp: (values: SignUpRequest) => Promise<AuthFailure | null>;
  isPending: boolean;
} {
  const router = useRouter();
  const { establishSession } = useAuth();
  const { mutateAsync, isPending } = useMutation({ mutationFn: register });

  const submitSignUp = useCallback(
    async (values: SignUpRequest): Promise<AuthFailure | null> => {
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

  return { submitSignUp, isPending };
}
