"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { CloseIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";

import { useClearAllData } from "../hooks/use-clear-all-data";

const WARNING_MESSAGE =
  "Are you sure you want to reset your profile data? This will permanently reset your avatar and notification preferences to their defaults. This action cannot be undone.";
const DATA_CLEARED_TOAST = "All profile data has been cleared.";
const GENERIC_FAILURE_MESSAGE = "Couldn't clear your data. Please try again.";
const CONFIRMATION_VALUE = "DELETE";

interface ClearAllDataBodyProps {
  onCleared: () => void;
}

function ClearAllDataBody({ onCleared }: Readonly<ClearAllDataBodyProps>) {
  const { submitClearAllData, isPending } = useClearAllData();
  const toast = useToast();
  const [confirmationText, setConfirmationText] = useState("");
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const isConfirmEnabled = confirmationText === CONFIRMATION_VALUE;

  const handleConfirm = async () => {
    setAlertMessage(null);
    const result = await submitClearAllData({ confirmation: confirmationText });
    if (result.ok) {
      toast.success(DATA_CLEARED_TOAST);
      onCleared();
      return;
    }
    setAlertMessage(GENERIC_FAILURE_MESSAGE);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => setConfirmationText(event.target.value);

  return (
    <div className="mt-6 flex flex-col gap-4">
      <p className="text-[15px] leading-6 text-slate-700">{WARNING_MESSAGE}</p>
      <div>
        <label htmlFor="clear-all-data-confirmation" className="mb-1 block text-sm font-medium text-brand-ink">
          Type DELETE to confirm
        </label>
        <input
          id="clear-all-data-confirmation"
          value={confirmationText}
          onChange={handleInputChange}
          className="h-11 w-full rounded-md border border-gray-300 px-3 text-[15px] text-brand-ink focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          autoComplete="off"
        />
      </div>
      {alertMessage ? <FormAlert message={alertMessage} /> : null}
      <Button
        variant="destructive"
        disabled={!isConfirmEnabled}
        isLoading={isPending}
        onClick={() => void handleConfirm()}
        className="w-full"
      >
        Clear All Data
      </Button>
    </div>
  );
}

export function ClearAllDataDialog() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <Button variant="destructive">Clear All Data</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40" />
        <Dialog.Content
          role="alertdialog"
          aria-labelledby="clear-all-data-title"
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white px-8 pb-8 pt-10 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.35)] focus:outline-none"
        >
          <Dialog.Title id="clear-all-data-title" className="text-center font-display text-2xl font-bold text-red-600">
            Clear All Data
          </Dialog.Title>
          <Dialog.Description className="sr-only">{WARNING_MESSAGE}</Dialog.Description>
          {isOpen ? <ClearAllDataBody onCleared={() => setIsOpen(false)} /> : null}
          <Dialog.Close asChild>
            <button
              type="button"
              aria-label="Close"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
