import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { eq } from "drizzle-orm";
import { SignJWT } from "jose";
import express from "express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { users } from "../../db/schema";
import { errorHandler } from "../../shared/errors/error-handler";
import {
  TEST_JWT_SECRET,
  TestClock,
  sendRequest,
  signUpBody,
  startTestApp,
  type TestApp,
} from "../../test-support/auth-test-harness";
import { JoseAccessTokenSigner } from "./ports/access-token-signer";
import { createRequireAuth, getAuthenticatedUserId } from "./require-auth";

const UNAUTHENTICATED = { code: "UNAUTHENTICATED", message: "Authentication required." };

describe("requireAuth on GET /me (T-UA-10)", () => {
  let app: TestApp;
  let accessToken: string;
  let user: { id: string };

  beforeEach(async () => {
    app = await startTestApp();
    const response = await sendRequest(app.baseUrl, "/api/v1/auth/signup", { body: signUpBody("jane@example.com") });
    ({ accessToken, user } = response.body as { accessToken: string; user: { id: string } });
  });

  afterEach(async () => {
    await app.close();
  });

  function me(authorization?: string) {
    return sendRequest(app.baseUrl, "/api/v1/auth/me", {
      headers: authorization === undefined ? {} : { authorization },
    });
  }

  it("a valid Bearer → 200 with the user", async () => {
    const response = await me(`Bearer ${accessToken}`);
    expect(response.status).toBe(200);
    expect((response.body as { user: { id: string } }).user.id).toBe(user.id);
  });

  it.each([
    ["no header", undefined],
    ["the Basic scheme", "Basic dXNlcjpwYXNz"],
    ["a lowercase scheme", "bearer TOKEN"],
    ["garbage", "Bearer not-a-jwt"],
    ["an empty token", "Bearer "],
  ])("%s → 401 UNAUTHENTICATED", async (_label, authorization) => {
    const header = authorization?.replace("TOKEN", accessToken);
    const response = await me(header);
    expect(response.status).toBe(401);
    expect(response.body).toEqual(UNAUTHENTICATED);
  });

  it("a token signed with another secret → 401 UNAUTHENTICATED", async () => {
    const otherSigner = new JoseAccessTokenSigner("some-other-secret-of-32-characters!!", app.clock);
    const response = await me(`Bearer ${await otherSigner.sign(user.id)}`);
    expect(response.status).toBe(401);
    expect(response.body).toEqual(UNAUTHENTICATED);
  });

  it("an expired token (clock + 15 min) → 401 UNAUTHENTICATED", async () => {
    app.clock.advanceBy(901 * 1000);
    const response = await me(`Bearer ${accessToken}`);
    expect(response.status).toBe(401);
    expect(response.body).toEqual(UNAUTHENTICATED);
  });

  it("a valid token for an account that no longer exists → 401 UNAUTHENTICATED", async () => {
    app.database.db.delete(users).where(eq(users.id, user.id)).run();
    const response = await me(`Bearer ${accessToken}`);
    expect(response.status).toBe(401);
    expect(response.body).toEqual(UNAUTHENTICATED);
  });
});

describe("requireAuth on another feature's route (T-UA-10, REQ-AUTH-08)", () => {
  let server: Server;
  let baseUrl: string;
  const clock = new TestClock();
  const signer = new JoseAccessTokenSigner(TEST_JWT_SECRET, clock);

  beforeEach(async () => {
    const app = express();
    app.get("/protected", createRequireAuth(signer), (request, response) => {
      response.json({ userId: getAuthenticatedUserId(request) });
    });
    app.get("/unguarded", (request, response) => {
      response.json({ userId: getAuthenticatedUserId(request) });
    });
    app.use(errorHandler);
    server = await new Promise<Server>((resolve) => {
      const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("the handler receives userId equal to the JWT sub", async () => {
    const token = await signer.sign("user-from-sub");
    const response = await sendRequest(baseUrl, "/protected", { headers: { authorization: `Bearer ${token}` } });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ userId: "user-from-sub" });
  });

  it("does not look at anything but the Bearer token (no database)", async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("any-id")
      .setIssuedAt(Math.floor(clock.now().getTime() / 1000))
      .setExpirationTime(Math.floor(clock.now().getTime() / 1000) + 900)
      .sign(new TextEncoder().encode(TEST_JWT_SECRET));
    const response = await sendRequest(baseUrl, "/protected", { headers: { authorization: `Bearer ${token}` } });
    expect(response.body).toEqual({ userId: "any-id" });
  });

  it("a missing token → 401 UNAUTHENTICATED", async () => {
    const response = await sendRequest(baseUrl, "/protected");
    expect(response.status).toBe(401);
    expect(response.body).toEqual(UNAUTHENTICATED);
  });

  it("reading the user id on a route without requireAuth → 401 UNAUTHENTICATED", async () => {
    const response = await sendRequest(baseUrl, "/unguarded");
    expect(response.status).toBe(401);
    expect(response.body).toEqual(UNAUTHENTICATED);
  });
});
