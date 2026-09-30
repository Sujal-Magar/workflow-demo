import { describe, expect, it } from "vitest";
import type { z } from "zod";

import {
  AUTH_VALIDATION_MESSAGES as MESSAGES,
  forgotPasswordRequestSchema,
  googleSignInRequestSchema,
  newPasswordFieldsSchema,
  resetPasswordRequestSchema,
  signInRequestSchema,
  signUpRequestSchema,
} from "./auth-validation";

const VALID_SIGN_UP = {
  name: "Piyush Sharma",
  email: "piyush@example.com",
  password: "abcdefg1!",
  confirmPassword: "abcdefg1!",
} as const;

/** First reported message per top-level field, the same reduction the API and the forms apply. */
function firstMessages(schema: z.ZodTypeAny, input: unknown): Record<string, string> {
  const result = schema.safeParse(input);
  const messages: Record<string, string> = {};
  if (result.success) {
    return messages;
  }
  for (const issue of result.error.issues) {
    const field = String(issue.path[0]);
    messages[field] ??= issue.message;
  }
  return messages;
}

function signUpMessages(overrides: Record<string, unknown>): Record<string, string> {
  return firstMessages(signUpRequestSchema, { ...VALID_SIGN_UP, ...overrides });
}

describe("SignUpRequest: one case per FDS §5 message row", () => {
  it("accepts a fully valid request", () => {
    expect(signUpRequestSchema.safeParse(VALID_SIGN_UP).success).toBe(true);
  });

  it("empty name → Name is required.", () => {
    expect(signUpMessages({ name: "" })).toEqual({ name: MESSAGES.NAME_REQUIRED });
  });

  it("1-character name → Name must be at least 2 characters.", () => {
    expect(signUpMessages({ name: "A" })).toEqual({ name: "Name must be at least 2 characters." });
  });

  it("empty email → Email is required.", () => {
    expect(signUpMessages({ email: "" })).toEqual({ email: "Email is required." });
  });

  it("malformed email → Enter a valid email address.", () => {
    expect(signUpMessages({ email: "user@" })).toEqual({ email: "Enter a valid email address." });
    expect(signUpMessages({ email: "not-an-email" })).toEqual({ email: "Enter a valid email address." });
  });

  it("empty password → Password is required. (first failing rule, not the length rule)", () => {
    const messages = signUpMessages({ password: "", confirmPassword: "" });
    expect(messages.password).toBe("Password is required.");
  });

  it("7-character password → Password must be at least 8 characters.", () => {
    expect(signUpMessages({ password: "abcd1!x", confirmPassword: "abcd1!x" })).toEqual({
      password: "Password must be at least 8 characters.",
    });
  });

  it("no digit → Password must include a number.", () => {
    expect(signUpMessages({ password: "abcdefgh!", confirmPassword: "abcdefgh!" })).toEqual({
      password: "Password must include a number.",
    });
  });

  it("no special character → Password must include a special character.", () => {
    expect(signUpMessages({ password: "abcdefg1", confirmPassword: "abcdefg1" })).toEqual({
      password: "Password must include a special character.",
    });
  });

  it("empty confirmation → Please confirm your password.", () => {
    expect(signUpMessages({ confirmPassword: "" })).toEqual({ confirmPassword: "Please confirm your password." });
  });

  it("mismatch → Passwords do not match.", () => {
    expect(signUpMessages({ confirmPassword: "abcdefg1?" })).toEqual({
      confirmPassword: "Passwords do not match.",
    });
  });
});

describe("rule behaviour", () => {
  it.each([
    ["space", "abcdefg1 "],
    ["underscore", "abcdefg1_"],
    ["non-ASCII letter é", "abcdefg1é"],
  ])("%s counts as a special character", (_label, password) => {
    expect(signUpMessages({ password, confirmPassword: password })).toEqual({});
  });

  it.each([
    ["absent", undefined],
    ["null", null],
    ["a number", 42],
    ["an object", { value: "x" }],
  ])("a %s value reports the empty message for every field", (_label, value) => {
    expect(
      firstMessages(signUpRequestSchema, { name: value, email: value, password: value, confirmPassword: value })
    ).toEqual({
      name: MESSAGES.NAME_REQUIRED,
      email: MESSAGES.EMAIL_REQUIRED,
      password: MESSAGES.PASSWORD_REQUIRED,
      confirmPassword: MESSAGES.CONFIRM_PASSWORD_REQUIRED,
    });
  });

  it("a completely missing body object reports every field as empty", () => {
    expect(firstMessages(signUpRequestSchema, {})).toEqual({
      name: MESSAGES.NAME_REQUIRED,
      email: MESSAGES.EMAIL_REQUIRED,
      password: MESSAGES.PASSWORD_REQUIRED,
      confirmPassword: MESSAGES.CONFIRM_PASSWORD_REQUIRED,
    });
  });

  it('a whitespace-only name "   " → Name is required. (D-05)', () => {
    expect(signUpMessages({ name: "   " })).toEqual({ name: MESSAGES.NAME_REQUIRED });
  });

  it("trims name and email and returns the trimmed values", () => {
    const result = signUpRequestSchema.parse({ ...VALID_SIGN_UP, name: "  Piyush  ", email: "  a@b.co  " });
    expect(result.name).toBe("Piyush");
    expect(result.email).toBe("a@b.co");
  });

  it("does not trim passwords", () => {
    const result = signUpRequestSchema.parse({ ...VALID_SIGN_UP, password: " abcdef1 ", confirmPassword: " abcdef1 " });
    expect(result.password).toBe(" abcdef1 ");
  });

  it("accepts an uppercase email without lowercasing it", () => {
    const result = signInRequestSchema.parse({ email: "Piyush@Example.COM", password: "x" });
    expect(result.email).toBe("Piyush@Example.COM");
  });

  it("reports the mismatch alongside a short password", () => {
    expect(signUpMessages({ password: "short", confirmPassword: "different" })).toEqual({
      password: "Password must be at least 8 characters.",
      confirmPassword: "Passwords do not match.",
    });
  });

  it("reports every failing field at once", () => {
    expect(
      firstMessages(signUpRequestSchema, { name: "A", email: "bad", password: "abc", confirmPassword: "" })
    ).toEqual({
      name: "Name must be at least 2 characters.",
      email: "Enter a valid email address.",
      password: "Password must be at least 8 characters.",
      confirmPassword: "Please confirm your password.",
    });
  });
});

describe("SignInRequest", () => {
  it("accepts a one-character password (no strength check on login)", () => {
    expect(signInRequestSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });

  it("reports empty email and password", () => {
    expect(firstMessages(signInRequestSchema, { email: "", password: "" })).toEqual({
      email: MESSAGES.EMAIL_REQUIRED,
      password: MESSAGES.PASSWORD_REQUIRED,
    });
  });
});

describe("GoogleSignInRequest", () => {
  it("empty token → Token is required.", () => {
    expect(firstMessages(googleSignInRequestSchema, { token: "" })).toEqual({ token: "Token is required." });
    expect(firstMessages(googleSignInRequestSchema, {})).toEqual({ token: "Token is required." });
  });

  it("accepts any non-empty token", () => {
    expect(googleSignInRequestSchema.safeParse({ token: "id-token" }).success).toBe(true);
  });
});

describe("ForgotPasswordRequest", () => {
  it("validates the email only", () => {
    expect(firstMessages(forgotPasswordRequestSchema, { email: "" })).toEqual({ email: MESSAGES.EMAIL_REQUIRED });
    expect(firstMessages(forgotPasswordRequestSchema, { email: "x@" })).toEqual({ email: MESSAGES.EMAIL_INVALID });
    expect(forgotPasswordRequestSchema.safeParse({ email: "x@y.io" }).success).toBe(true);
  });
});

describe("NewPasswordFields and ResetPasswordRequest", () => {
  it("newPasswordFieldsSchema works on its own, without a token", () => {
    expect(newPasswordFieldsSchema.safeParse({ password: "abcdefg1!", confirmPassword: "abcdefg1!" }).success).toBe(
      true
    );
    expect(firstMessages(newPasswordFieldsSchema, { password: "abcdefg1!", confirmPassword: "nope" })).toEqual({
      confirmPassword: MESSAGES.PASSWORDS_DO_NOT_MATCH,
    });
  });

  it("empty token → Token is required., alongside the password fields", () => {
    expect(firstMessages(resetPasswordRequestSchema, { token: "", password: "abc", confirmPassword: "abd" })).toEqual({
      token: "Token is required.",
      password: MESSAGES.PASSWORD_TOO_SHORT,
      confirmPassword: MESSAGES.PASSWORDS_DO_NOT_MATCH,
    });
  });

  it("does not trim the token", () => {
    const result = resetPasswordRequestSchema.parse({
      token: " raw-token ",
      password: "abcdefg1!",
      confirmPassword: "abcdefg1!",
    });
    expect(result.token).toBe(" raw-token ");
  });
});
