"use client";

import { forwardRef, useId, useState } from "react";

import { IconInput, type IconInputProps } from "./icon-input";
import { EyeIcon, EyeOffIcon, LockIcon } from "./icons";

const SHOW_PASSWORD_LABEL = "Show password";
const HIDE_PASSWORD_LABEL = "Hide password";

export type PasswordInputProps = Omit<IconInputProps, "icon" | "trailing" | "type">;

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { id, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [isVisible, setIsVisible] = useState(false);

  return (
    <IconInput
      ref={ref}
      id={inputId}
      type={isVisible ? "text" : "password"}
      icon={<LockIcon />}
      trailing={
        <button
          type="button"
          onClick={() => setIsVisible((visible) => !visible)}
          aria-label={isVisible ? HIDE_PASSWORD_LABEL : SHOW_PASSWORD_LABEL}
          aria-pressed={isVisible}
          aria-controls={inputId}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
        >
          {isVisible ? <EyeOffIcon className="h-[22px] w-[22px]" /> : <EyeIcon className="h-[22px] w-[22px]" />}
        </button>
      }
      {...props}
    />
  );
});
