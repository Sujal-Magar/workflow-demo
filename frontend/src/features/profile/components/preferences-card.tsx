import type { UserProfile } from "@workflow-demo/contracts";
import { DataManagementActions } from "./data-management-actions";
import { NotificationPreferencesList } from "./notification-preferences-list";
import { ReadOnlyPreferencesList } from "./read-only-preferences-list";

interface PreferencesCardProps {
  profile: UserProfile;
}

export function PreferencesCard({ profile }: Readonly<PreferencesCardProps>) {
  return (
    <div className="flex flex-col gap-6 rounded-2xl bg-white p-8 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)]">
      <ReadOnlyPreferencesList profile={profile} />
      <NotificationPreferencesList notificationPreferences={profile.notificationPreferences} />
      <DataManagementActions />
    </div>
  );
}
