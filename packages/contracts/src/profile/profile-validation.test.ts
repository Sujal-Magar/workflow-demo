import { describe, expect, it } from "vitest";
import type { z } from "zod";

import { strongPasswordSchema } from "../auth/auth-validation";
import {
  CLEAR_DATA_CONFIRMATION_LITERAL,
  PROFILE_VALIDATION_MESSAGES as MESSAGES,
  changePasswordRequestSchema,
  clearAllUserDataRequestSchema,
  clearDataConfirmationSchema,
  updateUserProfileRequestSchema,
} from "./profile-validation";

/** First reported message per top-level field, same reduction the API applies. */
function firstMessages(schema: z.ZodTypeAny, input: unknown): Record<string, string> {
  const result = schema.safeParse(input);
  const messages: Record<string, string> = {};
  if (result.success) {
    return messages;
  }
  for (const issue of result.error.issues) {
    const field = issue.path.join(".");
    messages[field] ??= issue.message;
  }
  return messages;
}

describe("DisplayName rule set (contract §4, D-09): name on UpdateUserProfileRequest", () => {
  it("accepts a fully absent name (unchanged)", () => {
    expect(updateUserProfileRequestSchema.safeParse({ avatarUrl: "https://x.test/a.png" }).success).toBe(true);
  });

  it("empty (after trim) → Name is required.", () => {
    expect(firstMessages(updateUserProfileRequestSchema, { name: "   " })).toEqual({ name: MESSAGES.NAME_REQUIRED });
  });

  it("1 character → rejected: Name must be at least 2 characters.", () => {
    expect(firstMessages(updateUserProfileRequestSchema, { name: "A" })).toEqual({ name: MESSAGES.NAME_TOO_SHORT });
  });

  it("2 characters → accepted", () => {
    expect(updateUserProfileRequestSchema.safeParse({ name: "Al" }).success).toBe(true);
  });

  it("100 characters → accepted", () => {
    expect(updateUserProfileRequestSchema.safeParse({ name: "A".repeat(100) }).success).toBe(true);
  });

  it("101 characters → rejected: Name must be at most 100 characters.", () => {
    expect(firstMessages(updateUserProfileRequestSchema, { name: "A".repeat(101) })).toEqual({
      name: MESSAGES.NAME_TOO_LONG,
    });
  });

  it("trims before checking and storing", () => {
    const result = updateUserProfileRequestSchema.parse({ name: "  Jane  " });
    expect(result.name).toBe("Jane");
  });
});

describe("AvatarUrl rule set (contract §4)", () => {
  it("absence is fine (unchanged)", () => {
    expect(updateUserProfileRequestSchema.safeParse({ name: "Jane Doe" }).success).toBe(true);
  });

  it("present and empty → Avatar URL cannot be empty.", () => {
    expect(firstMessages(updateUserProfileRequestSchema, { avatarUrl: "" })).toEqual({
      avatarUrl: MESSAGES.AVATAR_URL_EMPTY,
    });
  });

  it("a non-empty string is accepted", () => {
    expect(updateUserProfileRequestSchema.safeParse({ avatarUrl: "https://x.test/a.png" }).success).toBe(true);
  });
});

describe("updateUserProfileRequestSchema: unknown/not-accepted fields (D-05)", () => {
  it("strips preferredCurrency, language, monthlyStartDate, email, id, createdAt, updatedAt", () => {
    const parsed = updateUserProfileRequestSchema.parse({
      name: "Jane Doe",
      preferredCurrency: "USD",
      language: "fr",
      monthlyStartDate: 15,
      email: "new@example.com",
      id: "some-id",
      createdAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2020-01-01T00:00:00.000Z",
    });
    expect(Object.keys(parsed).sort()).toEqual(["name"]);
  });

  it("every field absent → 400-shaped failure, no field errors (nothing to do)", () => {
    const result = updateUserProfileRequestSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldIssues = result.error.issues.filter((issue) => issue.path.length > 0);
      expect(fieldIssues).toHaveLength(0);
      expect(result.error.issues[0]?.message).toBe(MESSAGES.AT_LEAST_ONE_FIELD_REQUIRED);
    }
  });

  it("a present notificationPreferences key counts as a field (not the empty-body error)", () => {
    expect(
      updateUserProfileRequestSchema.safeParse({ notificationPreferences: { goalReminders: false } }).success
    ).toBe(true);
  });
});

describe("ChangePasswordRequest (contract §2.4, §4)", () => {
  it("empty currentPassword → Current password is required.", () => {
    expect(
      firstMessages(changePasswordRequestSchema, {
        currentPassword: "",
        newPassword: "abcdefg1!",
        confirmPassword: "abcdefg1!",
      })
    ).toEqual({ currentPassword: MESSAGES.CURRENT_PASSWORD_REQUIRED });
  });

  it("empty confirmPassword → Please confirm your password.", () => {
    expect(
      firstMessages(changePasswordRequestSchema, {
        currentPassword: "abcdefg1!",
        newPassword: "abcdefg1!",
        confirmPassword: "",
      })
    ).toEqual({ confirmPassword: MESSAGES.CONFIRM_PASSWORD_REQUIRED });
  });

  it("NewStrongPassword genuinely reuses auth's strongPasswordSchema (same schema instance, not a redefinition, D-07)", () => {
    expect(changePasswordRequestSchema.shape.newPassword).toBe(strongPasswordSchema);
  });

  it("newPassword complexity messages are auth's own (8 chars, digit, special char)", () => {
    expect(
      firstMessages(changePasswordRequestSchema, {
        currentPassword: "abcdefg1!",
        newPassword: "short1!",
        confirmPassword: "short1!",
      })
    ).toEqual({ newPassword: "Password must be at least 8 characters." });
    expect(
      firstMessages(changePasswordRequestSchema, {
        currentPassword: "abcdefg1!",
        newPassword: "abcdefgh!",
        confirmPassword: "abcdefgh!",
      })
    ).toEqual({ newPassword: "Password must include a number." });
    expect(
      firstMessages(changePasswordRequestSchema, {
        currentPassword: "abcdefg1!",
        newPassword: "abcdefg1",
        confirmPassword: "abcdefg1",
      })
    ).toEqual({ newPassword: "Password must include a special character." });
  });

  it("does not itself check confirmPassword === newPassword (that is a service-layer check, §7 C6)", () => {
    expect(
      changePasswordRequestSchema.safeParse({
        currentPassword: "abcdefg1!",
        newPassword: "abcdefg1!",
        confirmPassword: "different-pass2?",
      }).success
    ).toBe(true);
  });

  it("accepts a fully valid request", () => {
    expect(
      changePasswordRequestSchema.safeParse({
        currentPassword: "abcdefg1!",
        newPassword: "zyxwvut9?",
        confirmPassword: "zyxwvut9?",
      }).success
    ).toBe(true);
  });
});

describe("ClearDataConfirmation rule set (contract §4) / ClearAllUserDataRequest", () => {
  it('exactly "DELETE" is accepted', () => {
    expect(clearDataConfirmationSchema.safeParse(CLEAR_DATA_CONFIRMATION_LITERAL).success).toBe(true);
    expect(clearAllUserDataRequestSchema.safeParse({ confirmation: "DELETE" }).success).toBe(true);
  });

  it.each([
    ["lowercase", "delete"],
    ["mixed case", "Delete"],
    ["empty", ""],
    ["missing", undefined],
    ["other text", "confirm"],
  ])("%s → Type DELETE to confirm.", (_label, value) => {
    expect(firstMessages(clearAllUserDataRequestSchema, { confirmation: value })).toEqual({
      confirmation: MESSAGES.CLEAR_DATA_CONFIRMATION,
    });
  });

  it("a completely missing body → Type DELETE to confirm.", () => {
    expect(firstMessages(clearAllUserDataRequestSchema, {})).toEqual({
      confirmation: MESSAGES.CLEAR_DATA_CONFIRMATION,
    });
  });
});
