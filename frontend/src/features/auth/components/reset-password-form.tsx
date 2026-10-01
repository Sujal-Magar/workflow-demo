"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";

import { newPasswordFieldsSchema, type NewPasswordFields } from "@workflow-demo/contracts";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { PasswordInput } from "@/components/ui/password-input";

import { useResetPassword } from "../hooks/use-reset-password";
import { applyFieldErrors } from "../lib/apply-field-errors";
import {
  CONFIRM_NEW_PASSWORD_PLACEHOLDER,
  NEW_PASSWORD_PLACEHOLDER,
  RESET_FAILED,
  RESET_PASSWORD_BUTTON,
} from "../lib/auth-copy";

// `password` is New Password and `confirmPassword` is Confirm New Password; a `token` field error has no field.
const NEW_PASSWORD_FIELDS = ["password", "confirmPassword"] as const;

interface ResetPasswordFormProps {
  token: string;
  onInvalidToken: () => void;
}

export function ResetPasswordForm({ token, onInvalidToken }: Readonly<ResetPasswordFormProps>) {
  const { submitNewPassword, isPending } = useResetPassword(token);
  const [hasResetFailed, setHasResetFailed] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<NewPasswordFields>({
    resolver: zodResolver(newPasswordFieldsSchema),
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const submitValidForm = async (values: NewPasswordFields) => {
    const failure = await submitNewPassword(values);
    if (!failure) {
      return;
    }
    if (failure.kind === "invalid-reset-token") {
      onInvalidToken();
    } else if (failure.kind === "field-errors") {
      applyFieldErrors(failure.fieldErrors, NEW_PASSWORD_FIELDS, setError);
    } else {
      setHasResetFailed(true);
    }
  };

  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    setHasResetFailed(false);
    void handleSubmit(submitValidForm)(event);
  };

  return (
    <form noValidate onSubmit={submitForm} className="flex w-full flex-col items-center">
      <div className="flex w-full flex-col gap-5">
        <PasswordInput
          label={NEW_PASSWORD_PLACEHOLDER}
          autoComplete="new-password"
          containerClassName="w-full"
          error={errors.password?.message}
          {...register("password")}
        />
        <PasswordInput
          label={CONFIRM_NEW_PASSWORD_PLACEHOLDER}
          autoComplete="new-password"
          containerClassName="w-full"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
      </div>
      {hasResetFailed ? <FormAlert message={RESET_FAILED} className="mt-4" /> : null}
      <Button type="submit" className="mt-6" isLoading={isPending}>
        {RESET_PASSWORD_BUTTON}
      </Button>
    </form>
  );
}
