"use client";

import { Checkbox } from "@/components/ui/checkbox";

import {
  useToggleNotificationPreference,
  type NotificationPreferenceKey,
} from "../hooks/use-toggle-notification-preference";
import type { NotificationPreferences } from "../mocks/profile-types.mock";

const PREFERENCE_LABELS: Readonly<Record<NotificationPreferenceKey, string>> = {
  budgetLimitAlerts: "Budget Limit Alerts",
  goalReminders: "Goal Reminders",
  weeklySummaryEmails: "Weekly Summary Emails",
};

const PREFERENCE_ORDER: readonly NotificationPreferenceKey[] = [
  "budgetLimitAlerts",
  "goalReminders",
  "weeklySummaryEmails",
];

interface NotificationPreferencesListProps {
  notificationPreferences: NotificationPreferences;
}

/** Each checkbox toggles independently and saves immediately via `updateUserProfile` (D-06, behavior.md §3). */
export function NotificationPreferencesList({ notificationPreferences }: Readonly<NotificationPreferencesListProps>) {
  const { toggle } = useToggleNotificationPreference();

  return (
    <div>
      <p className="mb-2 text-[15px] font-medium text-brand-ink">Notification Preferences:</p>
      <div className="flex flex-col gap-2">
        {PREFERENCE_ORDER.map((key) => (
          <Checkbox
            key={key}
            label={PREFERENCE_LABELS[key]}
            checked={notificationPreferences[key]}
            onChange={(event) => void toggle(key, event.target.checked)}
          />
        ))}
      </div>
    </div>
  );
}
