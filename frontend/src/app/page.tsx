"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { FullPageLoader } from "@/components/ui/full-page-loader";
import { useAuth } from "@/features/auth/session/use-auth";

/** Root route: loader while the session restores, then `/dashboard` or `/auth` (REQ-AUTH-07). */
export default function RootPage() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    } else if (status === "unauthenticated") {
      router.replace("/auth");
    }
  }, [status, router]);

  return <FullPageLoader />;
}
