"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { ToastProvider } from "@/components/ui/toast";
import { AuthProvider } from "@/features/auth/session/auth-provider";
import { GoogleAvailabilityProvider } from "@/features/auth/session/google-availability-provider";

/** Order matters: QueryClient → Toast → Google availability → Auth. No default `staleTime` (plan FE-11, FE-14). */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <GoogleAvailabilityProvider>
          <AuthProvider>{children}</AuthProvider>
        </GoogleAvailabilityProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
