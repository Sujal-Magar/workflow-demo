import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { passwordResetTokens, refreshTokens } from "../../db/schema";
import {
  OTHER_STRONG_PASSWORD,
  STRONG_PASSWORD,
  createAuthTestContext,
  type AuthTestContext,
} from "../../test-support/auth-test-harness";
import { InvalidCredentialsError, InvalidResetTokenError, UnauthenticatedError } from "./auth-errors";

const THIRTY_MINUTES_MS = 30 * 60_000;
const ACK = { success: true, message: "If an account exists for that email, a reset link has been sent." };

let context: AuthTestContext;

beforeEach(() => {
  context = createAuthTestContext();
});

afterEach(() => {
  vi.restoreAllMocks();
  context.close();
});

function register(email = "jane@example.com") {
  return context.authService.register({ name: "Jane Doe", email, password: STRONG_PASSWORD });
}

function resetRows() {
  return context.database.db.select().from(passwordResetTokens).all();
}

function login(password: string, email = "jane@example.com") {
  return context.authService.login({ email, password });
}

describe("PasswordResetService.requestPasswordReset (T-UA-07)", () => {
  it("an unknown email gets the generic result, no token row and no mail", async () => {
    await expect(context.passwordResetService.requestPasswordReset("nobody@example.com")).resolves.toEqual(ACK);
    expect(resetRows()).toHaveLength(0);
    expect(context.mailer.messages).toHaveLength(0);
  });

  it("a known email gets one hashed token row at now + 30 min and a reset URL whose hash matches", async () => {
    const registered = await register();

    await expect(context.passwordResetService.requestPasswordReset("JANE@example.com")).resolves.toEqual(ACK);

    expect(context.mailer.messages).toHaveLength(1);
    const [message] = context.mailer.messages;
    expect(message?.email).toBe("jane@example.com");
    const rawToken = context.mailer.lastToken();
    expect(message?.resetUrl).toBe(`${context.config.frontendOrigin}/reset-password?token=${rawToken}`);
    const rows = resetRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: registered.user.id,
      tokenHash: context.tokenGenerator.hash(rawToken),
      expiresAt: new Date(context.clock.now().getTime() + THIRTY_MINUTES_MS).toISOString(),
      usedAt: null,
    });
    expect(rows[0]?.tokenHash).not.toBe(rawToken);
  });

  it("a second request invalidates the first token", async () => {
    await register();
    await context.passwordResetService.requestPasswordReset("jane@example.com");
    const firstToken = context.mailer.lastToken();
    await context.passwordResetService.requestPasswordReset("jane@example.com");
    const secondToken = context.mailer.lastToken();

    const first = context.persistence.passwordResetTokens.findByHash(context.tokenGenerator.hash(firstToken));
    expect(first?.usedAt).not.toBeNull();
    await expect(
      context.passwordResetService.resetPassword({ token: firstToken, password: OTHER_STRONG_PASSWORD })
    ).rejects.toBeInstanceOf(InvalidResetTokenError);
    await expect(
      context.passwordResetService.resetPassword({ token: secondToken, password: OTHER_STRONG_PASSWORD })
    ).resolves.toBeUndefined();
  });

  it("a Google-only account gets a token", async () => {
    context.googleVerifier.register("token", { googleId: "g-1", email: "google@example.com" });
    await context.authService.signInWithGoogle("token");

    await context.passwordResetService.requestPasswordReset("google@example.com");

    expect(context.mailer.messages).toHaveLength(1);
    expect(resetRows()).toHaveLength(1);
  });
});

describe("PasswordResetService.resetPassword (T-UA-07)", () => {
  async function requestToken(email = "jane@example.com"): Promise<string> {
    await context.passwordResetService.requestPasswordReset(email);
    return context.mailer.lastToken();
  }

  it("replaces the hash, marks the token used and revokes all of the user's refresh tokens", async () => {
    const registered = await register();
    const secondSession = await login(STRONG_PASSWORD);
    const thirdSession = await login(STRONG_PASSWORD);
    const otherUser = await register("other@example.com");
    const token = await requestToken();

    await expect(
      context.passwordResetService.resetPassword({ token, password: OTHER_STRONG_PASSWORD })
    ).resolves.toBeUndefined();

    await expect(login(STRONG_PASSWORD)).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(login(OTHER_STRONG_PASSWORD)).resolves.toMatchObject({ user: registered.user });
    expect(context.persistence.passwordResetTokens.findByHash(context.tokenGenerator.hash(token))?.usedAt).toEqual(
      context.clock.now()
    );
    for (const rawToken of [registered.refreshToken, secondSession.refreshToken, thirdSession.refreshToken]) {
      await expect(context.authService.refreshSession(rawToken)).rejects.toBeInstanceOf(UnauthenticatedError);
    }
    await expect(context.authService.refreshSession(otherUser.refreshToken)).resolves.toMatchObject({
      user: otherUser.user,
    });
  });

  it("issues no session", async () => {
    const registered = await register();
    const token = await requestToken();
    const before = context.database.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.userId, registered.user.id))
      .all().length;

    const result = await context.passwordResetService.resetPassword({ token, password: OTHER_STRONG_PASSWORD });

    expect(result).toBeUndefined();
    const after = context.database.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.userId, registered.user.id))
      .all();
    expect(after).toHaveLength(before);
    expect(after.every((row) => row.revokedAt !== null)).toBe(true);
  });

  it("gives a Google-only account a password, keeps provider google, and lets it log in", async () => {
    context.googleVerifier.register("google-token", { googleId: "g-1", email: "google@example.com" });
    const googleSession = await context.authService.signInWithGoogle("google-token");
    const token = await requestToken("google@example.com");

    await context.passwordResetService.resetPassword({ token, password: OTHER_STRONG_PASSWORD });

    expect(context.persistence.users.findById(googleSession.user.id)).toMatchObject({
      provider: "google",
      googleId: "g-1",
    });
    await expect(login(OTHER_STRONG_PASSWORD, "google@example.com")).resolves.toMatchObject({
      user: googleSession.user,
    });
  });

  it("a reused token → InvalidResetTokenError", async () => {
    await register();
    const token = await requestToken();
    await context.passwordResetService.resetPassword({ token, password: OTHER_STRONG_PASSWORD });

    await expect(
      context.passwordResetService.resetPassword({ token, password: "third-pass1!" })
    ).rejects.toBeInstanceOf(InvalidResetTokenError);
    await expect(login(OTHER_STRONG_PASSWORD)).resolves.toBeDefined();
  });

  it("a token at exactly 30 minutes → InvalidResetTokenError", async () => {
    await register();
    const token = await requestToken();
    context.clock.advanceBy(THIRTY_MINUTES_MS);

    await expect(
      context.passwordResetService.resetPassword({ token, password: OTHER_STRONG_PASSWORD })
    ).rejects.toBeInstanceOf(InvalidResetTokenError);
    await expect(login(STRONG_PASSWORD)).resolves.toBeDefined();
  });

  it("a token later than 30 minutes → InvalidResetTokenError", async () => {
    await register();
    const token = await requestToken();
    context.clock.advanceBy(THIRTY_MINUTES_MS + 60_000);

    await expect(
      context.passwordResetService.resetPassword({ token, password: OTHER_STRONG_PASSWORD })
    ).rejects.toBeInstanceOf(InvalidResetTokenError);
  });

  it("a token just under 30 minutes still works", async () => {
    await register();
    const token = await requestToken();
    context.clock.advanceBy(THIRTY_MINUTES_MS - 1000);

    await expect(
      context.passwordResetService.resetPassword({ token, password: OTHER_STRONG_PASSWORD })
    ).resolves.toBeUndefined();
  });

  it("an unknown token → InvalidResetTokenError", async () => {
    await register();
    await expect(
      context.passwordResetService.resetPassword({ token: "unknown-token", password: OTHER_STRONG_PASSWORD })
    ).rejects.toBeInstanceOf(InvalidResetTokenError);
  });

  it("two concurrent resets with the same token: exactly one succeeds and only the winner's password logs in (A-1)", async () => {
    await register();
    const token = await requestToken();
    const passwords = ["winner-or-loser1!", "loser-or-winner2!"];

    const results = await Promise.allSettled(
      passwords.map((password) => context.passwordResetService.resetPassword({ token, password }))
    );

    const fulfilledIndexes = results.flatMap((result, index) => (result.status === "fulfilled" ? [index] : []));
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilledIndexes).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(InvalidResetTokenError);
    const winnerIndex = fulfilledIndexes[0] ?? -1;
    const winner = passwords[winnerIndex] ?? "";
    const loser = passwords[1 - winnerIndex] ?? "";
    await expect(login(winner)).resolves.toBeDefined();
    await expect(login(loser)).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(login(STRONG_PASSWORD)).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
