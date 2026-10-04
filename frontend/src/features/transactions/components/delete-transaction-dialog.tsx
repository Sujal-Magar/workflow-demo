"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { useToast } from "@/components/ui/toast";

import type { Transaction } from "../api/transactions-api";
import { useDeleteTransaction } from "../hooks/use-delete-transaction";
import { TRANSACTION_TOAST_OPTIONS } from "../lib/transaction-toast";

/** Verbatim fds.md/behavior.md copy. */
const TITLE = "Delete Transaction?";
const BODY_COPY = "Are you sure you want to delete this transaction? This action cannot be undone.";
/** Decision D-12 (plan.md). */
const SUCCESS_TOAST = "Transaction deleted successfully!";
const FAILURE_MESSAGE = "Couldn't delete the transaction. Please try again.";

interface DeleteTransactionBodyProps {
  transaction: Transaction;
  onDeleted: () => void;
}

function DeleteTransactionBody({ transaction, onDeleted }: Readonly<DeleteTransactionBodyProps>) {
  const { submitDeleteTransaction, isPending } = useDeleteTransaction();
  const toast = useToast();
  const [hasFailed, setHasFailed] = useState(false);

  const handleDelete = async () => {
    setHasFailed(false);
    const result = await submitDeleteTransaction(transaction.id);
    if (result.ok) {
      toast.success(SUCCESS_TOAST, TRANSACTION_TOAST_OPTIONS);
      onDeleted();
      return;
    }
    setHasFailed(true);
  };

  return (
    <div className="mt-4 flex flex-col items-center gap-4">
      {hasFailed ? <FormAlert message={FAILURE_MESSAGE} className="text-center" /> : null}
      <div className="flex justify-center gap-3">
        <Dialog.Close asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Dialog.Close>
        <Button type="button" variant="destructive" isLoading={isPending} onClick={() => void handleDelete()}>
          Delete
        </Button>
      </div>
    </div>
  );
}

interface DeleteTransactionDialogProps {
  transaction: Transaction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Opened from a row's trash icon (plan FE-04/FE-07); externally controlled; built on the existing Dialog
 * primitive with `role="alertdialog"` semantics — no `@radix-ui/react-alert-dialog`, not installed/approved. */
export function DeleteTransactionDialog({ transaction, open, onOpenChange }: Readonly<DeleteTransactionDialogProps>) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40" />
        <Dialog.Content
          role="alertdialog"
          aria-labelledby="delete-transaction-title"
          aria-describedby="delete-transaction-description"
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white px-8 py-10 text-center shadow-[0_24px_60px_-20px_rgba(15,23,42,0.35)] focus:outline-none"
        >
          <Dialog.Title id="delete-transaction-title" className="font-display text-2xl font-bold text-brand-ink">
            {TITLE}
          </Dialog.Title>
          <Dialog.Description id="delete-transaction-description" className="mt-3 text-[15px] leading-6 text-slate-600">
            {BODY_COPY}
          </Dialog.Description>
          {open ? <DeleteTransactionBody transaction={transaction} onDeleted={() => onOpenChange(false)} /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
