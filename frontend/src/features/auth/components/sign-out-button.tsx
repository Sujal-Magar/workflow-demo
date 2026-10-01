"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { SIGN_OUT_BUTTON } from "../lib/auth-copy";
import { useAuth } from "../session/use-auth";

export function SignOutButton() {
  const { logout } = useAuth();
  const [isPending, setIsPending] = useState(false);

  const signOut = async () => {
    setIsPending(true);
    try {
      await logout();
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button onClick={signOut} disabled={isPending} className="normal-case">
      {SIGN_OUT_BUTTON}
    </Button>
  );
}
