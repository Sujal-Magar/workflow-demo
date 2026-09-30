"use client";

import { DashboardPlaceholder } from "@/features/auth/components/dashboard-placeholder";
import { useAuth } from "@/features/auth/session/use-auth";

export default function DashboardPage() {
  const { user } = useAuth();
  // The (protected) layout renders this page only once the session is authenticated.
  if (!user) {
    return null;
  }
  return <DashboardPlaceholder sessionUser={user} />;
}
