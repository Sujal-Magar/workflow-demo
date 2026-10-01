import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { users } from "../../db/schema";
import { STRONG_PASSWORD, createAuthTestContext, type AuthTestContext } from "../../test-support/auth-test-harness";
import { InvalidGoogleTokenError } from "./auth-errors";
import type { NewUser } from "./user-repository";

let context: AuthTestContext;

beforeEach(() => {
  context = createAuthTestContext();
});

afterEach(() => {
  vi.restoreAllMocks();
  context.close();
});

function userCount(): number {
  return context.database.db.select().from(users).all().length;
}

function registerEmailAccount(email = "jane@example.com") {
  return context.authService.register({ name: "Jane Doe", email, password: STRONG_PASSWORD });
}

describe("AuthService.signInWithGoogle (T-UA-05)", () => {
  it("unknown email creates a google account with no password and the resolved name", async () => {
    context.googleVerifier.register("token", { googleId: "g-1", email: "new@example.com", name: "  New Person " });

    const session = await context.authService.signInWithGoogle("token");

    expect(session.user).toEqual({ id: session.user.id, name: "New Person", email: "new@example.com" });
    expect(context.persistence.users.findById(session.user.id)).toMatchObject({
      provider: "google",
      passwordHash: null,
      googleId: "g-1",
    });
    await expect(context.accessTokenSigner.verify(session.accessToken)).resolves.toBe(session.user.id);
    expect(
      context.persistence.refreshTokens.findByHash(context.tokenGenerator.hash(session.refreshToken))
    ).not.toBeNull();
  });

  it("resolves the name from the email when the claim is missing", async () => {
    context.googleVerifier.register("token", { googleId: "g-1", email: "jo.smith@example.com" });
    const session = await context.authService.signInWithGoogle("token");
    expect(session.user.name).toBe("jo.smith");
  });

  it("an existing Google ID signs in without writing to the account", async () => {
    context.googleVerifier.register("token", { googleId: "g-1", email: "new@example.com", name: "New Person" });
    const first = await context.authService.signInWithGoogle("token");
    const before = context.persistence.users.findById(first.user.id);
    context.clock.advanceBy(60_000);

    const second = await context.authService.signInWithGoogle("token");

    expect(second.user).toEqual(first.user);
    expect(context.persistence.users.findById(first.user.id)).toEqual(before);
    expect(userCount()).toBe(1);
  });

  it("links an email account with no Google ID, keeping provider and password hash and bumping updatedAt", async () => {
    const registered = await registerEmailAccount();
    const before = context.persistence.users.findById(registered.user.id);
    context.clock.advanceBy(60_000);
    context.googleVerifier.register("token", { googleId: "g-1", email: "jane@example.com", name: "Other Name" });

    const session = await context.authService.signInWithGoogle("token");

    expect(session.user).toEqual(registered.user);
    const after = context.persistence.users.findById(registered.user.id);
    expect(after).toMatchObject({
      provider: "email",
      passwordHash: before?.passwordHash,
      googleId: "g-1",
      name: "Jane Doe",
      updatedAt: context.clock.now(),
    });
    expect(userCount()).toBe(1);
  });

  it("an uppercase token email matches the lowercase account", async () => {
    const registered = await registerEmailAccount();
    context.googleVerifier.register("token", { googleId: "g-1", email: "JANE@Example.com" });

    const session = await context.authService.signInWithGoogle("token");

    expect(session.user.id).toBe(registered.user.id);
    expect(userCount()).toBe(1);
  });

  it("a different linked Google ID → InvalidGoogleTokenError with the row unchanged", async () => {
    const registered = await registerEmailAccount();
    context.googleVerifier.register("first", { googleId: "g-1", email: "jane@example.com" });
    await context.authService.signInWithGoogle("first");
    const before = context.persistence.users.findById(registered.user.id);
    context.clock.advanceBy(60_000);
    context.googleVerifier.register("second", { googleId: "g-2", email: "jane@example.com" });

    await expect(context.authService.signInWithGoogle("second")).rejects.toBeInstanceOf(InvalidGoogleTokenError);

    expect(context.persistence.users.findById(registered.user.id)).toEqual(before);
  });

  it("a verifier failure → InvalidGoogleTokenError and no user", async () => {
    await expect(context.authService.signInWithGoogle("unknown-token")).rejects.toBeInstanceOf(InvalidGoogleTokenError);
    expect(userCount()).toBe(0);
  });

  it("email_verified false → InvalidGoogleTokenError and no user", async () => {
    context.googleVerifier.register("token", { googleId: "g-1", email: "new@example.com", emailVerified: false });
    await expect(context.authService.signInWithGoogle("token")).rejects.toBeInstanceOf(InvalidGoogleTokenError);
    expect(userCount()).toBe(0);
  });

  it("falls back to linking when creating the account loses an email race (D-14)", async () => {
    const userRepository = context.persistence.users;
    const createUser = userRepository.createUser.bind(userRepository);
    let competitorId = "";
    vi.spyOn(userRepository, "createUser").mockImplementationOnce((newUser: NewUser) => {
      // A concurrent email sign-up commits between the email lookup and this insert.
      competitorId = "11111111-2222-4333-8444-555555555555";
      createUser({
        ...newUser,
        id: competitorId,
        name: "Email Racer",
        passwordHash: "$argon2id$competitor",
        provider: "email",
        googleId: null,
      });
      return createUser(newUser);
    });
    context.googleVerifier.register("token", { googleId: "g-1", email: "race@example.com", name: "Google Racer" });

    const session = await context.authService.signInWithGoogle("token");

    expect(session.user.id).toBe(competitorId);
    expect(context.persistence.users.findById(competitorId)).toMatchObject({
      provider: "email",
      googleId: "g-1",
      passwordHash: "$argon2id$competitor",
    });
    expect(userCount()).toBe(1);
  });

  it("fails after one retry when the email is still taken", async () => {
    vi.spyOn(context.persistence.users, "createUser").mockReturnValue({ status: "email-taken" });
    vi.spyOn(context.persistence.users, "findByEmail").mockReturnValue(null);
    context.googleVerifier.register("token", { googleId: "g-1", email: "race@example.com" });

    await expect(context.authService.signInWithGoogle("token")).rejects.toThrow(
      "Google account resolution failed: the email was still taken after one retry."
    );
    expect(context.persistence.users.createUser).toHaveBeenCalledTimes(2);
  });

  it("an email account already holding the same Google ID is returned without a write", async () => {
    const registered = await registerEmailAccount();
    context.googleVerifier.register("token", { googleId: "g-1", email: "jane@example.com" });
    await context.authService.signInWithGoogle("token");
    const before = context.persistence.users.findById(registered.user.id);
    // Force the email path even though the Google ID lookup would have matched.
    vi.spyOn(context.persistence.users, "findByGoogleId").mockReturnValueOnce(null);
    const linkGoogleId = vi.spyOn(context.persistence.users, "linkGoogleId");

    const session = await context.authService.signInWithGoogle("token");

    expect(session.user.id).toBe(registered.user.id);
    expect(linkGoogleId).not.toHaveBeenCalled();
    expect(context.persistence.users.findById(registered.user.id)).toEqual(before);
  });
});
