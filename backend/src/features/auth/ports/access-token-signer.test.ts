import { SignJWT, UnsecuredJWT, decodeJwt, decodeProtectedHeader } from "jose";
import { describe, expect, it } from "vitest";

import { TEST_JWT_SECRET, TestClock } from "../../../test-support/auth-test-harness";
import { JoseAccessTokenSigner } from "./access-token-signer";

const USER_ID = "3f1c2a4e-8d5b-4c7a-9e0f-1a2b3c4d5e6f";
const SECONDS = 1000;

function secretKey(secret: string = TEST_JWT_SECRET): Uint8Array {
  return new TextEncoder().encode(secret);
}

function nowSeconds(clock: TestClock): number {
  return Math.floor(clock.now().getTime() / SECONDS);
}

describe("JoseAccessTokenSigner (T-UA-02)", () => {
  it("signs HS256 with sub = user id and exp = iat + 900", async () => {
    const clock = new TestClock();
    const token = await new JoseAccessTokenSigner(TEST_JWT_SECRET, clock).sign(USER_ID);

    expect(decodeProtectedHeader(token).alg).toBe("HS256");
    const payload = decodeJwt(token);
    expect(payload.sub).toBe(USER_ID);
    expect(payload.iat).toBe(nowSeconds(clock));
    expect(payload.exp).toBe(nowSeconds(clock) + 900);
  });

  it("verifies its own token and returns the user id", async () => {
    const signer = new JoseAccessTokenSigner(TEST_JWT_SECRET, new TestClock());
    await expect(signer.verify(await signer.sign(USER_ID))).resolves.toBe(USER_ID);
  });

  it("rejects a token signed with another secret", async () => {
    const clock = new TestClock();
    const otherSigner = new JoseAccessTokenSigner("another-secret-that-is-32-characters-long", clock);
    const token = await otherSigner.sign(USER_ID);
    await expect(new JoseAccessTokenSigner(TEST_JWT_SECRET, clock).verify(token)).resolves.toBeNull();
  });

  it("accepts the token just before expiry and rejects it once expired (injected clock)", async () => {
    const clock = new TestClock();
    const signer = new JoseAccessTokenSigner(TEST_JWT_SECRET, clock);
    const token = await signer.sign(USER_ID);

    clock.advanceBy(899 * SECONDS);
    await expect(signer.verify(token)).resolves.toBe(USER_ID);

    clock.advanceBy(2 * SECONDS);
    await expect(signer.verify(token)).resolves.toBeNull();
  });

  it('rejects an unsecured token (alg: "none")', async () => {
    const clock = new TestClock();
    const token = new UnsecuredJWT({})
      .setSubject(USER_ID)
      .setIssuedAt(nowSeconds(clock))
      .setExpirationTime(nowSeconds(clock) + 900)
      .encode();
    await expect(new JoseAccessTokenSigner(TEST_JWT_SECRET, clock).verify(token)).resolves.toBeNull();
  });

  it("rejects another algorithm even with the right secret (HS512)", async () => {
    const clock = new TestClock();
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS512" })
      .setSubject(USER_ID)
      .setIssuedAt(nowSeconds(clock))
      .setExpirationTime(nowSeconds(clock) + 900)
      .sign(secretKey());
    await expect(new JoseAccessTokenSigner(TEST_JWT_SECRET, clock).verify(token)).resolves.toBeNull();
  });

  it("rejects a token without sub, or with an empty sub", async () => {
    const clock = new TestClock();
    const signer = new JoseAccessTokenSigner(TEST_JWT_SECRET, clock);
    const withoutSubject = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(nowSeconds(clock))
      .setExpirationTime(nowSeconds(clock) + 900)
      .sign(secretKey());
    const withEmptySubject = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("")
      .setIssuedAt(nowSeconds(clock))
      .setExpirationTime(nowSeconds(clock) + 900)
      .sign(secretKey());

    await expect(signer.verify(withoutSubject)).resolves.toBeNull();
    await expect(signer.verify(withEmptySubject)).resolves.toBeNull();
  });

  it("rejects a token without exp", async () => {
    const clock = new TestClock();
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(USER_ID)
      .setIssuedAt(nowSeconds(clock))
      .sign(secretKey());
    await expect(new JoseAccessTokenSigner(TEST_JWT_SECRET, clock).verify(token)).resolves.toBeNull();
  });

  it("rejects garbage", async () => {
    await expect(new JoseAccessTokenSigner(TEST_JWT_SECRET, new TestClock()).verify("not.a.jwt")).resolves.toBeNull();
  });
});
