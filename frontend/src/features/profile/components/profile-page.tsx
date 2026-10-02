"use client";

import { Button } from "@/components/ui/button";

import { useProfile } from "../hooks/use-profile";
import { PreferencesCard } from "./preferences-card";
import { ProfileIdentityCard } from "./profile-identity-card";

function ProfilePageSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2" aria-busy="true" aria-label="Loading profile">
      <div className="h-80 animate-pulse rounded-2xl bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)]" />
      <div className="h-80 animate-pulse rounded-2xl bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)]" />
    </div>
  );
}

interface ProfilePageErrorProps {
  onRetry: () => void;
}

function ProfilePageError({ onRetry }: Readonly<ProfilePageErrorProps>) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)]">
      <p className="text-[15px] text-slate-700">Couldn&apos;t load your profile. Please try again.</p>
      <Button onClick={onRetry}>Retry</Button>
    </div>
  );
}

export function ProfilePage() {
  const { data: profile, isPending, isError, refetch } = useProfile();

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-8 text-3xl font-semibold text-brand-ink">My Profile</h1>
        {isPending ? <ProfilePageSkeleton /> : null}
        {!isPending && isError ? <ProfilePageError onRetry={() => void refetch()} /> : null}
        {!isPending && !isError && profile ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ProfileIdentityCard profile={profile} />
            <PreferencesCard profile={profile} />
          </div>
        ) : null}
      </div>
    </main>
  );
}
