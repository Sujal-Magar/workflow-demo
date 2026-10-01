"use client";

import type { ReactNode } from "react";

import { ProtectedRoute } from "@/features/auth/guards/protected-route";

/** Every protected page (`/dashboard`, and later `/transactions`, `/budget`, `/goals`, `/reports`, `/profile`) lives in this group (D-13). */
export default function ProtectedLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
