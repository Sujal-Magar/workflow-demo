"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { clearAllData } from "../api/profile-api";
import type { ProfileResult } from "../lib/profile-error";
import type { ClearAllUserDataRequest, ProfileSuccessAck, UserProfile } from "@workflow-demo/contracts";
import { PROFILE_QUERY_KEY } from "./use-profile";

export function useClearAllData(): {
  submitClearAllData: (values: ClearAllUserDataRequest) => Promise<ProfileResult<ProfileSuccessAck>>;
  isPending: boolean;
} {
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: clearAllData,
    onSuccess: (result) => {
      if (!result.ok) {
        return;
      }
      // contract.md §5.5: avatarUrl and every notification preference reset to baseline; nothing else changes.
      const previous = queryClient.getQueryData<UserProfile>(PROFILE_QUERY_KEY);
      if (previous) {
        queryClient.setQueryData<UserProfile>(PROFILE_QUERY_KEY, {
          ...previous,
          avatarUrl: null,
          notificationPreferences: { budgetLimitAlerts: true, goalReminders: true, weeklySummaryEmails: true },
        });
      }
    },
  });
  return { submitClearAllData: mutateAsync, isPending };
}
