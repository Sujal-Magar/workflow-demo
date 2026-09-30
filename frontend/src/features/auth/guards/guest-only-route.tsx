"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { FullPageLoader } from "@/components/ui/full-page-loader";

import { useAuth } from "../session/use-auth";

/** Loader while the session restores; `/dashboard` when signed in; the children only when signed out. */
export function GuestOnlyRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  if (status !== "unauthenticated") {
    return <FullPageLoader />;
  }
  return <>{children}</>;
}
