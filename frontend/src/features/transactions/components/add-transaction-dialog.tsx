"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as Dialog from "@radix-ui/react-dialog";
import type { FormEvent } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { CloseIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";

import { useCreateTransaction } from "../hooks/use-create-transaction";
import { transactionFormSchema, type TransactionFormValues } from "../lib/transaction-form-schemas";
import { TRANSACTION_TOAST_OPTIONS } from "../lib/transaction-toast";
import { TransactionFormFields } from "./transaction-form-fields";

/** Exact FDS copy (fds.md §4, REQ-TXN-01). */
const SUCCESS_TOAST = "Transaction added successfully!";
const FAILURE_TOAST = "Failed to add transaction. Please try again.";

const DEFAULT_VALUES: TransactionFormValues = {
  title: "",
  description: "",
  category: "",
  type: "",
  amount: "",
};

interface AddTransactionBodyProps {
  onAdded: () => void;
}

function AddTransactionBody({ onAdded }: Readonly<AddTransactionBodyProps>) {
  const { submitCreateTransaction, isPending } = useCreateTransaction();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const submitValidForm = async (values: TransactionFormValues) => {
    const parsed = transactionFormSchema.parse(values);
    const result = await submitCreateTransaction(parsed);
    if (result.ok) {
      toast.success(SUCCESS_TOAST, TRANSACTION_TOAST_OPTIONS);
      onAdded();
      return;
    }
    // Form state is preserved on failure (behavior.md §2) — the inputs are simply left as the user typed them.
    toast.error(FAILURE_TOAST, TRANSACTION_TOAST_OPTIONS);
  };

  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    event.stopPropagation();
    void handleSubmit(submitValidForm)(event);
  };

  return (
    <form noValidate onSubmit={submitForm} className="mt-6 flex flex-col gap-4">
      <TransactionFormFields register={register} errors={errors} />
      <div className="mt-2 flex justify-end gap-3">
        <Dialog.Close asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Dialog.Close>
        <Button type="submit" isLoading={isPending}>
          Add
        </Button>
      </div>
    </form>
  );
}

interface AddTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Opened from the toolbar's "+ Add Transaction" button (plan FE-02/FE-03); externally controlled. */
export function AddTransactionDialog({ open, onOpenChange }: Readonly<AddTransactionDialogProps>) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white px-8 pb-8 pt-10 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.35)] focus:outline-none">
          <Dialog.Title className="font-display text-2xl font-bold text-brand-ink">Add Transaction</Dialog.Title>
          <Dialog.Description className="sr-only">Create a new income or expense transaction.</Dialog.Description>
          {open ? <AddTransactionBody onAdded={() => onOpenChange(false)} /> : null}
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
