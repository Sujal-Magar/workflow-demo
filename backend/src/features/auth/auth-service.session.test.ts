import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { refreshTokens, users } from "../../db/schema";
import { STRONG_PASSWORD, createAuthTestContext, type AuthTestContext } from "../../test-support/auth-test-harness";
import { UnauthenticatedError } from "./auth-errors";

const SEVEN_DAYS_MS = 604_800_000;

let context: AuthTestContext;

beforeEach(() => {
  context = createAuthTestContext();
});

afterEach(() => {
  vi.restoreAllMocks();
  context.close();
});

function register() {
  return context.authService.register({ name: "Jane Doe", email: "jane@example.com", password: STRONG_PASSWORD });
}

function storedToken(rawToken: string) {
  return context.persistence.refreshTokens.findByHash(context.tokenGenerator.hash(rawToken));
}

function tokensOf(userId: string) {
  return context.database.db.select().from(refreshTokens).where(eq(refreshTokens.userId, userId)).all();
}

describe("AuthService.refreshSession (T-UA-06)", () => {
  it("rotates a valid token: old revoked, new stored for now + 7 d, new raw value differs", async () => {
    const registered = await register();
    context.clock.advanceBy(60_000);

    const session = await context.authService.refreshSession(registered.refreshToken);

    expect(session.refreshToken).not.toBe(registered.refreshToken);
    expect(session.user).toEqual(registered.user);
    expect(session.expiresIn).toBe(900);
    await expect(context.accessTokenSigner.verify(session.accessToken)).resolves.toBe(registered.user.id);
    expect(storedToken(registered.refreshToken)?.revokedAt).toEqual(context.clock.now());
    const newToken = storedToken(session.refreshToken);
    expect(newToken?.revokedAt).toBeNull();
    expect(newToken?.expiresAt).toEqual(new Date(context.clock.now().getTime() + SEVEN_DAYS_MS));
  });

  it("a rotated token → UnauthenticatedError", async () => {
    const registered = await register();
    await context.authService.refreshSession(registered.refreshToken);

    await expect(context.authService.refreshSession(registered.refreshToken)).rejects.toBeInstanceOf(
      UnauthenticatedError
    );
  });

  it("an expired token (clock + 7 d) → UnauthenticatedError", async () => {
    const registered = await register();
    context.clock.advanceBy(SEVEN_DAYS_MS);

    await expect(context.authService.refreshSession(registered.refreshToken)).rejects.toBeInstanceOf(
      UnauthenticatedError
    );
  });

  it("a token just before expiry still refreshes", async () => {
    const registered = await register();
    context.clock.advanceBy(SEVEN_DAYS_MS - 1000);

    await expect(context.authService.refreshSession(registered.refreshToken)).resolves.toMatchObject({
      user: registered.user,
    });
  });

  it.each([
    ["unknown", "unknown-token-value"],
    ["missing", undefined],
    ["empty", ""],
  ])("an %s token → UnauthenticatedError", async (_label, token) => {
    await register();
    await expect(context.authService.refreshSession(token)).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("a deleted user → UnauthenticatedError", async () => {
    const registered = await register();
    // Keep the token row so the missing-account branch is reached (the FK would cascade it away).
    context.database.connection.pragma("foreign_keys = OFF");
    context.database.db.delete(users).where(eq(users.id, registered.user.id)).run();

    await expect(context.authService.refreshSession(registered.refreshToken)).rejects.toBeInstanceOf(
      UnauthenticatedError
    );
  });

  it("two concurrent refreshes with the same token: exactly one succeeds and one new row exists (A-1)", async () => {
    const registered = await register();

    const results = await Promise.allSettled([
      context.authService.refreshSession(registered.refreshToken),
      context.authService.refreshSession(registered.refreshToken),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(UnauthenticatedError);
    const rows = tokensOf(registered.user.id);
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.revokedAt === null)).toHaveLength(1);
  });
});

describe("AuthService.getCurrentUser (T-UA-06)", () => {
  it("returns the public user", async () => {
    const registered = await register();
    await expect(context.authService.getCurrentUser(registered.user.id)).resolves.toEqual(registered.user);
  });

  it("an unknown id → UnauthenticatedError", async () => {
    await expect(context.authService.getCurrentUser(randomUUID())).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});

describe("AuthService.logout (T-UA-06)", () => {
  it("revokes a valid token", async () => {
    const registered = await register();

    await context.authService.logout(registered.refreshToken);

    expect(storedToken(registered.refreshToken)?.revokedAt).toEqual(context.clock.now());
    await expect(context.authService.refreshSession(registered.refreshToken)).rejects.toBeInstanceOf(
      UnauthenticatedError
    );
  });

  it.each([
    ["unknown", "unknown-token-value"],
    ["missing", undefined],
    ["empty", ""],
  ])("resolves for an %s token", async (_label, token) => {
    await expect(context.authService.logout(token)).resolves.toBeUndefined();
  });

  it("resolves for an already-revoked token and keeps its first revocation time", async () => {
    const registered = await register();
    await context.authService.logout(registered.refreshToken);
    const firstRevokedAt = storedToken(registered.refreshToken)?.revokedAt;
    context.clock.advanceBy(60_000);

    await expect(context.authService.logout(registered.refreshToken)).resolves.toBeUndefined();
    expect(storedToken(registered.refreshToken)?.revokedAt).toEqual(firstRevokedAt);
  });
});
