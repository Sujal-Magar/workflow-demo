import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { userProfiles, users } from "../../db/schema";
import { STRONG_PASSWORD, createAuthTestContext, type AuthTestContext } from "../../test-support/auth-test-harness";
import { EmailAlreadyExistsError, InvalidCredentialsError } from "./auth-errors";

let context: AuthTestContext;

beforeEach(() => {
  context = createAuthTestContext();
});

afterEach(() => {
  vi.restoreAllMocks();
  context.close();
});

function register(email: string, password: string = STRONG_PASSWORD) {
  return context.authService.register({ name: "Jane Doe", email, password });
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the promise to reject.");
}

describe("AuthService.register (T-UA-04)", () => {
  it("creates an email account with a lowercase email, an argon2id hash and no Google ID", async () => {
    const session = await register("Jane@Example.COM");

    const stored = context.persistence.users.findById(session.user.id);
    expect(stored).toMatchObject({ name: "Jane Doe", email: "jane@example.com", provider: "email", googleId: null });
    expect(stored?.passwordHash?.startsWith("$argon2id$")).toBe(true);
    await expect(context.passwordHasher.verify(stored?.passwordHash ?? "", STRONG_PASSWORD)).resolves.toBe(true);
  });

  it("returns only the public user and a session", async () => {
    const session = await register("jane@example.com");

    expect(Object.keys(session.user).sort()).toEqual(["email", "id", "name"]);
    expect(session.user).toEqual({ id: session.user.id, name: "Jane Doe", email: "jane@example.com" });
    expect(session.expiresIn).toBe(900);
    await expect(context.accessTokenSigner.verify(session.accessToken)).resolves.toBe(session.user.id);
  });

  it("stores only the hash of the refresh token", async () => {
    const session = await register("jane@example.com");

    expect(context.persistence.refreshTokens.findByHash(session.refreshToken)).toBeNull();
    const stored = context.persistence.refreshTokens.findByHash(context.tokenGenerator.hash(session.refreshToken));
    expect(stored?.userId).toBe(session.user.id);
    expect(stored?.expiresAt).toEqual(new Date(context.clock.now().getTime() + 604_800_000));
  });

  it("creates no profile row (`profile`'s own getOrCreateProfile is lazy, D-11)", async () => {
    await register("jane@example.com");
    expect(context.database.db.select().from(users).all()).toHaveLength(1);
    expect(context.database.db.select().from(userProfiles).all()).toHaveLength(0);
  });

  it("rejects a duplicate email with the same case", async () => {
    await register("jane@example.com");
    await expect(register("jane@example.com")).rejects.toBeInstanceOf(EmailAlreadyExistsError);
  });

  it("rejects a duplicate email with a different case", async () => {
    await register("jane@example.com");
    await expect(register("JANE@example.com")).rejects.toBeInstanceOf(EmailAlreadyExistsError);
  });

  it("rejects an email that belongs to a Google-created account", async () => {
    context.googleVerifier.register("google-token", { googleId: "google-1", email: "jane@example.com" });
    await context.authService.signInWithGoogle("google-token");

    await expect(register("jane@example.com")).rejects.toBeInstanceOf(EmailAlreadyExistsError);
  });

  it("rejects the loser of a simulated sign-up race (email taken while hashing)", async () => {
    const results = await Promise.allSettled([register("race@example.com"), register("race@example.com")]);

    const rejected = results.filter((result) => result.status === "rejected");
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(EmailAlreadyExistsError);
    expect(context.database.db.select().from(users).all()).toHaveLength(1);
  });
});

describe("AuthService.login (T-UA-04)", () => {
  it("signs in case-insensitively and returns a session", async () => {
    const registered = await register("jane@example.com");

    const session = await context.authService.login({ email: "Jane@EXAMPLE.com", password: STRONG_PASSWORD });

    expect(session.user).toEqual(registered.user);
    expect(session.refreshToken).not.toBe(registered.refreshToken);
    await expect(context.accessTokenSigner.verify(session.accessToken)).resolves.toBe(registered.user.id);
  });

  it("unknown email, wrong password and Google-only account give the identical InvalidCredentialsError", async () => {
    await register("jane@example.com");
    context.googleVerifier.register("google-token", { googleId: "google-1", email: "google-only@example.com" });
    await context.authService.signInWithGoogle("google-token");

    const errors = [
      await captureError(context.authService.login({ email: "nobody@example.com", password: STRONG_PASSWORD })),
      await captureError(context.authService.login({ email: "jane@example.com", password: "wrong-password1!" })),
      await captureError(context.authService.login({ email: "google-only@example.com", password: STRONG_PASSWORD })),
    ];

    for (const error of errors) {
      expect(error).toBeInstanceOf(InvalidCredentialsError);
    }
    const shapes = errors.map((error) => {
      const { code, message, name } = error as InvalidCredentialsError;
      return { code, message, name };
    });
    expect(shapes[1]).toEqual(shapes[0]);
    expect(shapes[2]).toEqual(shapes[0]);
  });

  it("runs an argon2 verification for an unknown or password-less account (timing guard, D-16)", async () => {
    const verify = vi.spyOn(context.passwordHasher, "verify");

    await expect(
      context.authService.login({ email: "nobody@example.com", password: STRONG_PASSWORD })
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(
      context.authService.login({ email: "nobody2@example.com", password: STRONG_PASSWORD })
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(verify).toHaveBeenCalledTimes(2);
  });
});
