"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateProfile } from "../api/profile-api";
import type { ProfileResult } from "../lib/profile-error";
import type { UpdateUserProfileRequest, UserProfile } from "@workflow-demo/contracts";
import { PROFILE_QUERY_KEY } from "./use-profile";

export function useUpdateProfile(): {
  submitUpdateProfile: (values: UpdateUserProfileRequest) => Promise<ProfileResult<UserProfile>>;
  isPending: boolean;
} {
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: updateProfile,
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.setQueryData(PROFILE_QUERY_KEY, result.data);
      }
    },
  });
  return { submitUpdateProfile: mutateAsync, isPending };
}
