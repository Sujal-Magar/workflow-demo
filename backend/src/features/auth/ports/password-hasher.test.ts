import { describe, expect, it } from "vitest";

import { TEST_PASSWORD_HASHING_COST } from "../../../test-support/auth-test-harness";
import { Argon2PasswordHasher } from "./password-hasher";

describe("Argon2PasswordHasher (T-UA-02)", () => {
  const hasher = new Argon2PasswordHasher(TEST_PASSWORD_HASHING_COST);

  it("produces an argon2id hash using the configured cost", async () => {
    const passwordHash = await hasher.hash("abcdefg1!");
    expect(passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(passwordHash).toMatch(/m=1024,p=1,t=2/);
    expect(passwordHash).not.toContain("abcdefg1!");
  });

  it("verifies the right password as true and a wrong one as false", async () => {
    const passwordHash = await hasher.hash("abcdefg1!");
    await expect(hasher.verify(passwordHash, "abcdefg1!")).resolves.toBe(true);
    await expect(hasher.verify(passwordHash, "abcdefg1?")).resolves.toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hasher.hash("abcdefg1!")).not.toBe(await hasher.hash("abcdefg1!"));
  });
});
