"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useToast } from "@/components/ui/toast";

import { updateProfile } from "../api/profile-api";
import type { NotificationPreferences, UserProfile } from "../mocks/profile-types.mock";
import { PROFILE_QUERY_KEY } from "./use-profile";

const NOTIFICATION_PREFERENCE_UPDATE_FAILED = "Couldn't update your notification preference. Please try again.";

export type NotificationPreferenceKey = keyof NotificationPreferences;

interface ToggleVariables {
  readonly key: NotificationPreferenceKey;
  readonly value: boolean;
}

interface MutationContext {
  readonly previous: UserProfile | undefined;
}

function applyOptimisticToggle(queryClient: QueryClient, variables: ToggleVariables): MutationContext {
  const previous = queryClient.getQueryData<UserProfile>(PROFILE_QUERY_KEY);
  if (previous) {
    queryClient.setQueryData<UserProfile>(PROFILE_QUERY_KEY, {
      ...previous,
      notificationPreferences: { ...previous.notificationPreferences, [variables.key]: variables.value },
    });
  }
  return { previous };
}

/** Each toggle is its own optimistic `updateUserProfile` call (D-06), rolled back on failure. */
export function useToggleNotificationPreference(): {
  toggle: (key: NotificationPreferenceKey, value: boolean) => Promise<void>;
  isPending: boolean;
} {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (variables: ToggleVariables) =>
      updateProfile({ notificationPreferences: { [variables.key]: variables.value } }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: PROFILE_QUERY_KEY });
      return applyOptimisticToggle(queryClient, variables);
    },
    onSuccess: (result, _variables, context) => {
      if (result.ok) {
        queryClient.setQueryData(PROFILE_QUERY_KEY, result.data);
        return;
      }
      if (context?.previous) {
        queryClient.setQueryData(PROFILE_QUERY_KEY, context.previous);
      }
      toast.error(NOTIFICATION_PREFERENCE_UPDATE_FAILED);
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(PROFILE_QUERY_KEY, context.previous);
      }
      toast.error(NOTIFICATION_PREFERENCE_UPDATE_FAILED);
    },
  });

  const toggle = useCallback(
    async (key: NotificationPreferenceKey, value: boolean) => {
      await mutateAsync({ key, value });
    },
    [mutateAsync]
  );

  return { toggle, isPending };
}
