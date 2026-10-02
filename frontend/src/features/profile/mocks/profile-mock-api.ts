// Phase 5 in-memory stand-in for the profile API (plan FE-09), answering with the statuses and bodies of
// contract.md §5–§6. State lives in module memory only, never Web Storage. Deleted in INT-02/INT-03.
import type { ZodType } from "zod";

import {
  changePasswordFormSchema,
  clearAllUserDataFormSchema,
  editProfileFormSchema,
} from "./profile-form-schemas.mock";
import {
  createSeedProfile,
  DATA_CLEARED_MESSAGE,
  MOCK_LATENCY_MS,
  MOCK_NO_PASSWORD_MARKER,
  MOCK_RATE_LIMIT_THRESHOLD,
  MOCK_RATE_LIMIT_WINDOW_MS,
  MOCK_SEED_PASSWORD,
  PASSWORD_UPDATED_MESSAGE,
} from "./profile-mock-data";
import { PROFILE_ERROR_CODES, type ErrorBody, type ProfileErrorCode, type UserProfile } from "./profile-types.mock";

export interface MockResponse {
  readonly status: number;
  readonly body: unknown;
}

const ERROR_MESSAGES: Readonly<Record<ProfileErrorCode, string>> = {
  VALIDATION_ERROR: "Request validation failed.",
  UNAUTHENTICATED: "Authentication required.",
  NOT_FOUND: "Route not found.",
  INTERNAL_ERROR: "An unexpected error occurred.",
  INVALID_CREDENTIALS: "Incorrect current password.",
  PASSWORD_NOT_SET: "No password is set for this account. Use password recovery instead.",
  SAME_PASSWORD: "New password must be different from your current password.",
  PASSWORDS_DO_NOT_MATCH: "New password and confirmation do not match.",
  RATE_LIMIT_EXCEEDED: "Too many password change attempts. Please try again later.",
};

let profile: UserProfile = createSeedProfile();
let currentPassword: string = MOCK_SEED_PASSWORD;
let hasPassword = true;
let failureTimestamps: number[] = [];

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorResponse(status: number, code: ProfileErrorCode, fieldErrors?: Record<string, string>): MockResponse {
  const body: ErrorBody = { code, message: ERROR_MESSAGES[code] };
  return { status, body: fieldErrors ? { ...body, fieldErrors } : body };
}

/** Mirrors the server: the first failing rule per field becomes that field's `fieldErrors` entry. */
function validateBody<T>(
  schema: ZodType<T>,
  body: unknown
): { ok: true; data: T } | { ok: false; response: MockResponse } {
  const parsed = schema.safeParse(body);
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? "");
    if (field && !(field in fieldErrors)) {
      fieldErrors[field] = issue.message;
    }
  }
  return { ok: false, response: errorResponse(400, PROFILE_ERROR_CODES.VALIDATION_ERROR, fieldErrors) };
}

function recordFailure(): void {
  failureTimestamps.push(Date.now());
}

/** `attemptedAt > since`, strictly greater than (exclusive boundary, D-17). */
function countFailuresSince(since: number): number {
  return failureTimestamps.filter((attemptedAt) => attemptedAt > since).length;
}

export async function mockGetProfile(): Promise<MockResponse> {
  await delay(MOCK_LATENCY_MS);
  return { status: 200, body: profile };
}

export async function mockUpdateProfile(body: unknown): Promise<MockResponse> {
  await delay(MOCK_LATENCY_MS);
  const source = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const hasName = typeof source.name === "string";
  const hasAvatarUrl = typeof source.avatarUrl === "string";
  const notificationPreferences =
    typeof source.notificationPreferences === "object" && source.notificationPreferences !== null
      ? (source.notificationPreferences as Record<string, unknown>)
      : undefined;
  const hasNotificationPreferences =
    notificationPreferences !== undefined &&
    ["budgetLimitAlerts", "goalReminders", "weeklySummaryEmails"].some(
      (key) => typeof notificationPreferences[key] === "boolean"
    );

  if (!hasName && !hasAvatarUrl && !hasNotificationPreferences) {
    return errorResponse(400, PROFILE_ERROR_CODES.VALIDATION_ERROR, {});
  }

  const toValidate: Record<string, unknown> = {};
  if (hasName) {
    toValidate.name = source.name;
  }
  if (hasAvatarUrl) {
    toValidate.avatarUrl = source.avatarUrl;
  }
  const validation = validateBody(editProfileFormSchema.partial(), toValidate);
  if (!validation.ok) {
    return validation.response;
  }

  const updated: UserProfile = { ...profile, updatedAt: new Date().toISOString() };
  if (hasName) {
    updated.name = validation.data.name ?? profile.name;
  }
  if (hasAvatarUrl) {
    updated.avatarUrl = validation.data.avatarUrl || profile.avatarUrl;
  }
  if (hasNotificationPreferences) {
    updated.notificationPreferences = {
      budgetLimitAlerts:
        typeof notificationPreferences?.budgetLimitAlerts === "boolean"
          ? notificationPreferences.budgetLimitAlerts
          : profile.notificationPreferences.budgetLimitAlerts,
      goalReminders:
        typeof notificationPreferences?.goalReminders === "boolean"
          ? notificationPreferences.goalReminders
          : profile.notificationPreferences.goalReminders,
      weeklySummaryEmails:
        typeof notificationPreferences?.weeklySummaryEmails === "boolean"
          ? notificationPreferences.weeklySummaryEmails
          : profile.notificationPreferences.weeklySummaryEmails,
    };
  }
  profile = updated;
  return { status: 200, body: profile };
}

export async function mockChangePassword(body: unknown): Promise<MockResponse> {
  await delay(MOCK_LATENCY_MS);
  const validation = validateBody(changePasswordFormSchema, body);
  if (!validation.ok) {
    return validation.response;
  }
  const { currentPassword: submittedCurrentPassword, newPassword, confirmPassword } = validation.data;

  const since = Date.now() - MOCK_RATE_LIMIT_WINDOW_MS;
  if (countFailuresSince(since) >= MOCK_RATE_LIMIT_THRESHOLD) {
    return errorResponse(429, PROFILE_ERROR_CODES.RATE_LIMIT_EXCEEDED);
  }
  if (submittedCurrentPassword === MOCK_NO_PASSWORD_MARKER) {
    hasPassword = false;
  }
  if (!hasPassword) {
    return errorResponse(400, PROFILE_ERROR_CODES.PASSWORD_NOT_SET);
  }
  if (submittedCurrentPassword !== currentPassword) {
    recordFailure();
    return errorResponse(401, PROFILE_ERROR_CODES.INVALID_CREDENTIALS);
  }
  if (newPassword === submittedCurrentPassword) {
    return errorResponse(400, PROFILE_ERROR_CODES.SAME_PASSWORD);
  }
  if (confirmPassword !== newPassword) {
    return errorResponse(400, PROFILE_ERROR_CODES.PASSWORDS_DO_NOT_MATCH);
  }
  currentPassword = newPassword;
  return { status: 200, body: { success: true, message: PASSWORD_UPDATED_MESSAGE } };
}

export async function mockExportData(): Promise<MockResponse> {
  await delay(MOCK_LATENCY_MS);
  return { status: 200, body: profile };
}

export async function mockClearAllData(body: unknown): Promise<MockResponse> {
  await delay(MOCK_LATENCY_MS);
  const validation = validateBody(clearAllUserDataFormSchema, body);
  if (!validation.ok) {
    return validation.response;
  }
  profile = {
    ...profile,
    avatarUrl: null,
    notificationPreferences: {
      budgetLimitAlerts: true,
      goalReminders: true,
      weeklySummaryEmails: true,
    },
    updatedAt: new Date().toISOString(),
  };
  return { status: 200, body: { success: true, message: DATA_CLEARED_MESSAGE } };
}

/** Test-only reset hook (component tests import this to start from a clean slate each test). */
export function resetMockProfileState(): void {
  profile = createSeedProfile();
  currentPassword = MOCK_SEED_PASSWORD;
  hasPassword = true;
  failureTimestamps = [];
}
