"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";

import { signInRequestSchema, type SignInRequest } from "@workflow-demo/contracts";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { IconInput } from "@/components/ui/icon-input";
import { MailIcon } from "@/components/ui/icons";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/components/ui/toast";

import type { GoogleSignInControls } from "../hooks/use-google-sign-in";
import { useSignIn } from "../hooks/use-sign-in";
import { applyFieldErrors } from "../lib/apply-field-errors";
import {
  EMAIL_PLACEHOLDER,
  INVALID_CREDENTIALS,
  PASSWORD_PLACEHOLDER,
  SIGN_IN_BUTTON,
  SIGN_IN_DIVIDER,
  SIGN_IN_FAILED_TOAST,
  SIGN_IN_TITLE,
} from "../lib/auth-copy";
import { ForgotPasswordDialog } from "./forgot-password-dialog";
import { GoogleSignInButton } from "./google-sign-in-button";

const SIGN_IN_FIELDS = ["email", "password"] as const;
const EMPTY_SIGN_IN_VALUES: SignInRequest = { email: "", password: "" };

interface SignInFormProps {
  /** False while the sign-up view is shown; the form is then cleared. */
  isActive: boolean;
  google: GoogleSignInControls;
}

export function SignInForm({ isActive, google }: SignInFormProps) {
  const toast = useToast();
  const { submitSignIn, isPending } = useSignIn();
  const [isCredentialAlertVisible, setIsCredentialAlertVisible] = useState(false);
  // Increases on every rejected attempt so both inputs replay the shake animation.
  const [failedAttemptCount, setFailedAttemptCount] = useState(0);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<SignInRequest>({
    resolver: zodResolver(signInRequestSchema),
    defaultValues: EMPTY_SIGN_IN_VALUES,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  useEffect(() => {
    if (!isActive) {
      reset(EMPTY_SIGN_IN_VALUES);
      setIsCredentialAlertVisible(false);
      setFailedAttemptCount(0);
    }
  }, [isActive, reset]);

  const submitValidForm = async (values: SignInRequest) => {
    const failure = await submitSignIn(values);
    if (!failure) {
      return;
    }
    if (failure.kind === "invalid-credentials") {
      setIsCredentialAlertVisible(true);
      setFailedAttemptCount((count) => count + 1);
    } else if (failure.kind === "field-errors") {
      applyFieldErrors(failure.fieldErrors, SIGN_IN_FIELDS, setError);
    } else {
      toast.error(SIGN_IN_FAILED_TOAST);
    }
  };

  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    setIsCredentialAlertVisible(false);
    void handleSubmit(submitValidForm)(event);
  };

  const TitleTag = isActive ? "h1" : "h2";

  return (
    <form noValidate onSubmit={submitForm} className="flex w-full max-w-[320px] flex-col items-center text-center">
      <TitleTag className="font-display text-[32px] font-bold leading-tight text-brand-ink">{SIGN_IN_TITLE}</TitleTag>
      <div className="mt-5">
        <GoogleSignInButton controls={google} />
      </div>
      <p className="mt-5 text-[13px] text-gray-500">{SIGN_IN_DIVIDER}</p>
      {isCredentialAlertVisible ? <FormAlert message={INVALID_CREDENTIALS} className="mt-4" /> : null}
      <div className="mt-5 flex w-full flex-col gap-5">
        <IconInput
          label={EMAIL_PLACEHOLDER}
          icon={<MailIcon />}
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          shakeSignal={failedAttemptCount}
          {...register("email")}
        />
        <PasswordInput
          label={PASSWORD_PLACEHOLDER}
          autoComplete="current-password"
          error={errors.password?.message}
          shakeSignal={failedAttemptCount}
          {...register("password")}
        />
      </div>
      <ForgotPasswordDialog triggerClassName="mt-5" />
      <Button type="submit" className="mt-5" isLoading={isPending} disabled={google.isPending}>
        {SIGN_IN_BUTTON}
      </Button>
    </form>
  );
}
