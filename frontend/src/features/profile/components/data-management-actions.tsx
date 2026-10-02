"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

import { useExportData } from "../hooks/use-export-data";
import { ClearAllDataDialog } from "./clear-all-data-dialog";

const EXPORT_SUCCESS_TOAST = "Your data has been exported successfully.";
const EXPORT_FAILURE_TOAST = "Couldn't export your data. Please try again.";

export function DataManagementActions() {
  const { submitExportData, isPending } = useExportData();
  const toast = useToast();

  const handleExport = async () => {
    const result = await submitExportData();
    if (result.ok) {
      toast.success(EXPORT_SUCCESS_TOAST);
    } else {
      toast.error(EXPORT_FAILURE_TOAST);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button isLoading={isPending} onClick={() => void handleExport()}>
        Export Data
      </Button>
      <ClearAllDataDialog />
    </div>
  );
}
