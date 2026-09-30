"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as Dialog from "@radix-ui/react-dialog";
import { useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { IconInput } from "@/components/ui/icon-input";
import { CloseIcon, MailIcon } from "@/components/ui/icons";

import { useRequestPasswordReset } from "../hooks/use-request-password-reset";
import { applyFieldErrors } from "../lib/apply-field-errors";
import {
  BACK_TO_SIGN_IN_BUTTON,
  EMAIL_PLACEHOLDER,
  FORGOT_PASSWORD_LINK,
  RESET_DIALOG_DESCRIPTION,
  RESET_DIALOG_TITLE,
  RESET_REQUEST_FAILED,
  RESET_REQUEST_SENT,
  SEND_RESET_LINK_BUTTON,
} from "../lib/auth-copy";
import { forgotPasswordRequestSchema, type ForgotPasswordFormValues } from "../mocks/auth-form-schemas.mock";
import type { ForgotPasswordRequest } from "../mocks/auth-types.mock";

const FORGOT_PASSWORD_FIELDS = ["email"] as const;

/** Mounted only while the dialog is open, so every opening starts from an empty request step. */
function ForgotPasswordBody() {
  const { submitResetRequest, isPending } = useRequestPasswordReset();
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [hasRequestFailed, setHasRequestFailed] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues, unknown, ForgotPasswordRequest>({
    resolver: zodResolver(forgotPasswordRequestSchema),
    defaultValues: { email: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const submitValidForm = async (values: ForgotPasswordRequest) => {
    const result = await submitResetRequest(values);
    if (result.ok) {
      setSentMessage(result.data.message || RESET_REQUEST_SENT);
      return;
    }
    if (result.failure.kind === "field-errors") {
      applyFieldErrors(result.failure.fieldErrors, FORGOT_PASSWORD_FIELDS, setError);
      return;
    }
    setHasRequestFailed(true);
  };

  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    // The dialog is portalled out of the sign-in <form>, but React events still bubble through the tree.
    event.stopPropagation();
    setHasRequestFailed(false);
    void handleSubmit(submitValidForm)(event);
  };

  if (sentMessage) {
    return (
      <div className="mt-6 flex flex-col items-center text-center">
        <p role="status" className="text-[15px] leading-6 text-slate-600">
          {sentMessage}
        </p>
        <Dialog.Close asChild>
          <Button className="mt-6">{BACK_TO_SIGN_IN_BUTTON}</Button>
        </Dialog.Close>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={submitForm} className="mt-6 flex flex-col items-center">
      <IconInput
        label={EMAIL_PLACEHOLDER}
        icon={<MailIcon />}
        type="email"
        autoComplete="email"
        containerClassName="w-full"
        error={errors.email?.message}
        {...register("email")}
      />
      {hasRequestFailed ? <FormAlert message={RESET_REQUEST_FAILED} className="mt-4" /> : null}
      <Button type="submit" className="mt-6" isLoading={isPending}>
        {SEND_RESET_LINK_BUTTON}
      </Button>
    </form>
  );
}

interface ForgotPasswordDialogProps {
  triggerClassName?: string;
}

export function ForgotPasswordDialog({ triggerClassName }: ForgotPasswordDialogProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button variant="link" className={triggerClassName}>
          {FORGOT_PASSWORD_LINK}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white px-8 pb-8 pt-10 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.35)] focus:outline-none">
          <Dialog.Title className="text-center font-display text-2xl font-bold text-brand-ink">
            {RESET_DIALOG_TITLE}
          </Dialog.Title>
          <Dialog.Description className="sr-only">{RESET_DIALOG_DESCRIPTION}</Dialog.Description>
          <ForgotPasswordBody />
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
