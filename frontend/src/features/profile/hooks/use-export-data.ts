"use client";

import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";

import { exportData } from "../api/profile-api";
import type { ProfileResult } from "../lib/profile-error";
import type { UserProfile } from "@workflow-demo/contracts";

/** `profile-export-<ISO-date>.json` (contract.md §2.6); the date is today's, UTC. */
function exportFilename(): string {
  const isoDate = new Date().toISOString().slice(0, 10);
  return `profile-export-${isoDate}.json`;
}

/** Triggers the one-shot browser download of `data` (D-08: synchronous, no job/poll API). */
function downloadExportPayload(data: UserProfile): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFilename();
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function useExportData(): {
  submitExportData: () => Promise<ProfileResult<UserProfile>>;
  isPending: boolean;
} {
  const { mutateAsync, isPending } = useMutation({
    mutationFn: exportData,
    onSuccess: (result) => {
      if (result.ok) {
        downloadExportPayload(result.data);
      }
    },
  });
  const submitExportData = useCallback(() => mutateAsync(), [mutateAsync]);
  return { submitExportData, isPending };
}
