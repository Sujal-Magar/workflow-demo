"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { FullPageLoader } from "@/components/ui/full-page-loader";
import { ResetPasswordCard } from "@/features/auth/components/reset-password-card";

function ResetPasswordContent() {
  const token = useSearchParams().get("token");
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <ResetPasswordCard token={token} />
    </main>
  );
}

/** No guard: works whether or not the visitor is signed in (D-12). */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
