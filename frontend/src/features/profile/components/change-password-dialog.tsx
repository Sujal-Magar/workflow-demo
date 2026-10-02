"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as Dialog from "@radix-ui/react-dialog";
import { useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { CloseIcon } from "@/components/ui/icons";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/components/ui/toast";

import { changePasswordRequestSchema, type ChangePasswordRequest } from "@workflow-demo/contracts";

import { useChangePassword } from "../hooks/use-change-password";
import { applyFieldErrors } from "../lib/apply-field-errors";

const CHANGE_PASSWORD_FIELDS = ["currentPassword", "newPassword", "confirmPassword"] as const;
const PASSWORD_UPDATED_TOAST = "Password updated successfully!";
const INCORRECT_CURRENT_PASSWORD = "Incorrect current password.";
const SAME_PASSWORD_MESSAGE = "New password must be different from your current password.";
const PASSWORDS_DO_NOT_MATCH_MESSAGE = "New password and confirmation do not match.";
const PASSWORD_NOT_SET_MESSAGE = "No password is set for this account. Use password recovery instead.";
const RATE_LIMIT_MESSAGE = "Too many password change attempts. Please try again later.";
const GENERIC_FAILURE_MESSAGE = "Couldn't update your password. Please try again.";

const DEFAULT_VALUES: ChangePasswordRequest = { currentPassword: "", newPassword: "", confirmPassword: "" };

interface ChangePasswordBodyProps {
  onChanged: () => void;
}

function ChangePasswordBody({ onChanged }: Readonly<ChangePasswordBodyProps>) {
  const { submitChangePassword, isPending } = useChangePassword();
  const toast = useToast();
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ChangePasswordRequest>({
    resolver: zodResolver(changePasswordRequestSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const submitValidForm = async (values: ChangePasswordRequest) => {
    const result = await submitChangePassword(values);
    if (result.ok) {
      toast.success(PASSWORD_UPDATED_TOAST);
      onChanged();
      return;
    }
    switch (result.failure.kind) {
      case "field-errors":
        applyFieldErrors(result.failure.fieldErrors, CHANGE_PASSWORD_FIELDS, setError);
        return;
      case "invalid-credentials":
        setError("currentPassword", { type: "server", message: INCORRECT_CURRENT_PASSWORD }, { shouldFocus: true });
        return;
      case "same-password":
        setError("newPassword", { type: "server", message: SAME_PASSWORD_MESSAGE }, { shouldFocus: true });
        return;
      case "passwords-do-not-match":
        setError("confirmPassword", { type: "server", message: PASSWORDS_DO_NOT_MATCH_MESSAGE }, { shouldFocus: true });
        return;
      case "password-not-set":
        setAlertMessage(PASSWORD_NOT_SET_MESSAGE);
        return;
      case "rate-limit-exceeded":
        setIsRateLimited(true);
        setAlertMessage(RATE_LIMIT_MESSAGE);
        return;
      default:
        setAlertMessage(GENERIC_FAILURE_MESSAGE);
    }
  };

  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    event.stopPropagation();
    setAlertMessage(null);
    void handleSubmit(submitValidForm)(event);
  };

  return (
    <form noValidate onSubmit={submitForm} className="mt-6 flex flex-col items-center gap-4">
      <PasswordInput
        label="Current Password"
        autoComplete="current-password"
        containerClassName="w-full"
        error={errors.currentPassword?.message}
        {...register("currentPassword")}
      />
      <PasswordInput
        label="New Password"
        autoComplete="new-password"
        containerClassName="w-full"
        error={errors.newPassword?.message}
        {...register("newPassword")}
      />
      <PasswordInput
        label="Confirm New Password"
        autoComplete="new-password"
        containerClassName="w-full"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      {alertMessage ? <FormAlert message={alertMessage} /> : null}
      <Button type="submit" isLoading={isPending} disabled={isRateLimited} className="mt-2 w-full">
        Change Password
      </Button>
    </form>
  );
}

export function ChangePasswordDialog() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <Button variant="secondary">Change Password</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white px-8 pb-8 pt-10 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.35)] focus:outline-none">
          <Dialog.Title className="text-center font-display text-2xl font-bold text-brand-ink">
            Change Password
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            Update your account password using your current password.
          </Dialog.Description>
          {isOpen ? <ChangePasswordBody onChanged={() => setIsOpen(false)} /> : null}
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
