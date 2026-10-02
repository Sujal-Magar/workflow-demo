import type { UserProfile } from "../mocks/profile-types.mock";

const CURRENCY_SYMBOLS: Readonly<Record<UserProfile["preferredCurrency"], string>> = {
  NPR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

const LANGUAGE_LABELS: Readonly<Record<UserProfile["language"], { label: string; code: string }>> = {
  en_US: { label: "English", code: "EN" },
  en_GB: { label: "English", code: "EN" },
  es: { label: "Spanish", code: "ES" },
  fr: { label: "French", code: "FR" },
};

const ORDINAL_SUFFIXES: Readonly<Record<number, string>> = { 1: "st", 2: "nd", 3: "rd" };

function ordinal(day: number): string {
  const isTeen = day % 100 >= 11 && day % 100 <= 13;
  const suffix = isTeen ? "th" : (ORDINAL_SUFFIXES[day % 10] ?? "th");
  return `${day}${suffix}`;
}

interface ReadOnlyPreferencesListProps {
  profile: UserProfile;
}

/** Pure presentation, no inputs — these three fields are read-only in v1.0.0 (REQ-PROF-02). */
export function ReadOnlyPreferencesList({ profile }: Readonly<ReadOnlyPreferencesListProps>) {
  const currencyLabel = `${profile.preferredCurrency} (${CURRENCY_SYMBOLS[profile.preferredCurrency]})`;
  const language = LANGUAGE_LABELS[profile.language];
  const languageLabel = `${language.label} (${language.code})`;
  const monthlyStartDateLabel = `${ordinal(profile.monthlyStartDate)} of every month`;

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-[15px]">
      <dt className="font-medium text-brand-ink">Preferred Currency:</dt>
      <dd className="text-slate-700">{currencyLabel}</dd>
      <dt className="font-medium text-brand-ink">Language:</dt>
      <dd className="text-slate-700">{languageLabel}</dd>
      <dt className="font-medium text-brand-ink">Monthly Start Date:</dt>
      <dd className="text-slate-700">{monthlyStartDateLabel}</dd>
    </dl>
  );
}
