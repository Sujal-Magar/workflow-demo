"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { useAuthMode } from "../hooks/use-auth-mode";
import { useGoogleSignIn } from "../hooks/use-google-sign-in";
import { BrandPanel } from "./brand-panel";
import { SignInForm } from "./sign-in-form";
import { SignUpForm } from "./sign-up-form";

interface FormPanelProps {
  isActive: boolean;
  className: string;
  children: ReactNode;
}

/** Holds one form. Both stay mounted; the hidden one is `aria-hidden` and `inert`. */
function FormPanel({ isActive, className, children }: Readonly<FormPanelProps>) {
  const panelRef = useRef<HTMLDivElement>(null);
  const isHidden = !isActive;

  useEffect(() => {
    // @types/react 18 has no `inert` prop, so it is set on the element (plan FE-06, A-2).
    if (panelRef.current) {
      panelRef.current.inert = isHidden;
    }
  }, [isHidden]);

  return (
    <div
      ref={panelRef}
      aria-hidden={isHidden || undefined}
      className={cn(
        "flex items-center justify-center bg-white px-6 py-10 md:absolute md:inset-y-0 md:w-3/5 md:px-10 md:py-0",
        "motion-safe:transition-opacity motion-safe:duration-[600ms] motion-safe:ease-in-out",
        isActive ? "z-10 opacity-100" : "pointer-events-none z-0 hidden opacity-0 md:flex",
        className
      )}
    >
      {children}
    </div>
  );
}

export function AuthCard() {
  const { mode, switchMode } = useAuthMode();
  // Called once and shared by both panels (plan FE-09).
  const google = useGoogleSignIn();
  const isSignIn = mode === "signin";

  return (
    <div className="flex w-full max-w-[800px] flex-col overflow-hidden rounded-3xl bg-white shadow-[0_24px_60px_-20px_rgba(15,23,42,0.25)] md:relative md:block md:h-[600px] md:w-[800px]">
      <FormPanel isActive={isSignIn} className="md:left-0">
        <SignInForm isActive={isSignIn} google={google} />
      </FormPanel>
      <FormPanel isActive={!isSignIn} className="md:right-0">
        <SignUpForm isActive={!isSignIn} google={google} />
      </FormPanel>
      <BrandPanel
        mode={mode}
        onSwitchMode={switchMode}
        className={cn(
          "order-first md:absolute md:inset-y-0 md:left-0 md:z-20 md:w-2/5",
          "motion-safe:transition-transform motion-safe:duration-[600ms] motion-safe:ease-in-out",
          isSignIn ? "md:translate-x-[150%]" : "md:translate-x-0"
        )}
      />
    </div>
  );
}
