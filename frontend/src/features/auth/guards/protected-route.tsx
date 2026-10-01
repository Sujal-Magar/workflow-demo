"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { FullPageLoader } from "@/components/ui/full-page-loader";

import { useAuth } from "../session/use-auth";

/** Loader while the session restores; `/auth` when signed out; the children only when signed in. */
export function ProtectedRoute({ children }: Readonly<{ children: ReactNode }>) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth");
    }
  }, [status, router]);

  if (status !== "authenticated") {
    return <FullPageLoader />;
  }
  return <>{children}</>;
}
