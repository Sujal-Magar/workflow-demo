"use client";

import { Suspense } from "react";

import { FullPageLoader } from "@/components/ui/full-page-loader";
import { AuthCard } from "@/features/auth/components/auth-card";
import { GuestOnlyRoute } from "@/features/auth/guards/guest-only-route";

export default function AuthPage() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <GuestOnlyRoute>
        <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
          <AuthCard />
        </main>
      </GuestOnlyRoute>
    </Suspense>
  );
}
