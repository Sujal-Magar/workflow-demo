import type { UserProfile } from "@workflow-demo/contracts";
import { AvatarCircle } from "./avatar-circle";
import { ChangePasswordDialog } from "./change-password-dialog";
import { EditProfileDialog } from "./edit-profile-dialog";

interface ProfileIdentityCardProps {
  profile: UserProfile;
}

export function ProfileIdentityCard({ profile }: Readonly<ProfileIdentityCardProps>) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-white p-8 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)]">
      <AvatarCircle avatarUrl={profile.avatarUrl} name={profile.name} />
      <p className="mt-6 text-lg font-semibold text-brand-ink">Name: {profile.name}</p>
      <p className="mt-1 text-[15px] text-slate-600">Email: {profile.email}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <EditProfileDialog profile={profile} />
        <ChangePasswordDialog />
      </div>
    </div>
  );
}
