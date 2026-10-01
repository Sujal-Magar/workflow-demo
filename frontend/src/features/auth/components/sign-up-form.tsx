"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { signUpRequestSchema, type SignUpRequest } from "@workflow-demo/contracts";

import { Button } from "@/components/ui/button";
import { IconInput } from "@/components/ui/icon-input";
import { MailIcon, UserIcon } from "@/components/ui/icons";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/components/ui/toast";

import type { GoogleSignInControls } from "../hooks/use-google-sign-in";
import { useSignUp } from "../hooks/use-sign-up";
import { applyFieldErrors } from "../lib/apply-field-errors";
import {
  CONFIRM_PASSWORD_PLACEHOLDER,
  EMAIL_EXISTS_TOAST,
  EMAIL_PLACEHOLDER,
  NAME_PLACEHOLDER,
  PASSWORD_PLACEHOLDER,
  SIGN_UP_BUTTON,
  SIGN_UP_DIVIDER,
  SIGN_UP_FAILED_TOAST,
  SIGN_UP_TITLE,
} from "../lib/auth-copy";
import { GoogleSignInButton } from "./google-sign-in-button";

const SIGN_UP_FIELDS = ["name", "email", "password", "confirmPassword"] as const;
const EMPTY_SIGN_UP_VALUES: SignUpRequest = { name: "", email: "", password: "", confirmPassword: "" };

interface SignUpFormProps {
  /** False while the sign-in view is shown; the form is then cleared. */
  isActive: boolean;
  google: GoogleSignInControls;
}

export function SignUpForm({ isActive, google }: Readonly<SignUpFormProps>) {
  const toast = useToast();
  const { submitSignUp, isPending } = useSignUp();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<SignUpRequest>({
    resolver: zodResolver(signUpRequestSchema),
    defaultValues: EMPTY_SIGN_UP_VALUES,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  useEffect(() => {
    if (!isActive) {
      reset(EMPTY_SIGN_UP_VALUES);
    }
  }, [isActive, reset]);

  const submitValidForm = async (values: SignUpRequest) => {
    const failure = await submitSignUp(values);
    if (!failure) {
      return;
    }
    if (failure.kind === "email-exists") {
      toast.error(EMAIL_EXISTS_TOAST);
    } else if (failure.kind === "field-errors") {
      applyFieldErrors(failure.fieldErrors, SIGN_UP_FIELDS, setError);
    } else {
      toast.error(SIGN_UP_FAILED_TOAST);
    }
  };

  const TitleTag = isActive ? "h1" : "h2";

  return (
    <form
      noValidate
      onSubmit={handleSubmit(submitValidForm)}
      className="flex w-full max-w-[320px] flex-col items-center text-center"
    >
      <TitleTag className="font-display text-[32px] font-bold leading-tight text-brand-ink">{SIGN_UP_TITLE}</TitleTag>
      <div className="mt-5">
        <GoogleSignInButton controls={google} />
      </div>
      <p className="mt-5 text-[13px] text-gray-500">{SIGN_UP_DIVIDER}</p>
      <div className="mt-5 flex w-full flex-col gap-5">
        <IconInput
          label={NAME_PLACEHOLDER}
          icon={<UserIcon />}
          type="text"
          autoComplete="name"
          error={errors.name?.message}
          {...register("name")}
        />
        <IconInput
          label={EMAIL_PLACEHOLDER}
          icon={<MailIcon />}
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <PasswordInput
          label={PASSWORD_PLACEHOLDER}
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <PasswordInput
          label={CONFIRM_PASSWORD_PLACEHOLDER}
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
      </div>
      <Button type="submit" className="mt-[22px]" isLoading={isPending} disabled={google.isPending}>
        {SIGN_UP_BUTTON}
      </Button>
    </form>
  );
}
