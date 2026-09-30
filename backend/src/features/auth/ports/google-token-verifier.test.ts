import { describe, expect, it, vi } from "vitest";

import { GoogleAuthLibraryTokenVerifier, type IdTokenVerificationClient } from "./google-token-verifier";

const CLIENT_ID = "client-id.apps.googleusercontent.com";

type Claims = Record<string, unknown> | undefined;

function stubClient(claims: Claims): IdTokenVerificationClient & { verifyIdToken: ReturnType<typeof vi.fn> } {
  return { verifyIdToken: vi.fn().mockResolvedValue({ getPayload: () => claims }) };
}

const VALID_CLAIMS = { sub: "google-123", email: "Jane@Example.com", email_verified: true, name: "Jane" };

describe("GoogleAuthLibraryTokenVerifier (T-UA-02)", () => {
  it("passes the configured client ID as the audience and returns the identity", async () => {
    const client = stubClient(VALID_CLAIMS);
    const verifier = new GoogleAuthLibraryTokenVerifier(CLIENT_ID, client);

    await expect(verifier.verify("id-token")).resolves.toEqual({
      googleId: "google-123",
      email: "Jane@Example.com",
      emailVerified: true,
      name: "Jane",
    });
    expect(client.verifyIdToken).toHaveBeenCalledWith({ idToken: "id-token", audience: CLIENT_ID });
  });

  it("returns a null name when the claim is missing", async () => {
    const claims = { sub: VALID_CLAIMS.sub, email: VALID_CLAIMS.email, email_verified: true };
    const identity = await new GoogleAuthLibraryTokenVerifier(CLIENT_ID, stubClient(claims)).verify("id-token");
    expect(identity?.name).toBeNull();
  });

  it("a library error → invalid", async () => {
    const client: IdTokenVerificationClient = {
      verifyIdToken: vi.fn().mockRejectedValue(new Error("Wrong recipient, payload audience != requiredAudience")),
    };
    await expect(new GoogleAuthLibraryTokenVerifier(CLIENT_ID, client).verify("id-token")).resolves.toBeNull();
  });

  it.each([
    ["email_verified false", { ...VALID_CLAIMS, email_verified: false }],
    ["email_verified missing", { sub: "google-123", email: "a@b.co", name: "A" }],
    ["sub missing", { email: "a@b.co", email_verified: true }],
    ["email missing", { sub: "google-123", email_verified: true }],
    ["no payload", undefined],
  ])("%s → invalid", async (_label, claims) => {
    await expect(
      new GoogleAuthLibraryTokenVerifier(CLIENT_ID, stubClient(claims)).verify("id-token")
    ).resolves.toBeNull();
  });

  it("without a client ID → invalid, and Google is never called (D-08)", async () => {
    const client = stubClient(VALID_CLAIMS);
    await expect(new GoogleAuthLibraryTokenVerifier(null, client).verify("id-token")).resolves.toBeNull();
    expect(client.verifyIdToken).not.toHaveBeenCalled();
  });

  it("builds a default library client when none is injected", async () => {
    await expect(new GoogleAuthLibraryTokenVerifier(null).verify("id-token")).resolves.toBeNull();
  });
});
