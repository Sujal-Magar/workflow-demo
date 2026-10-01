import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { CryptoTokenGenerator } from "./token-generator";

const BASE64URL_43 = /^[A-Za-z0-9_-]{43}$/;

describe("CryptoTokenGenerator (T-UA-02)", () => {
  const generator = new CryptoTokenGenerator();

  it("generates 32 random bytes as 43-character base64url", () => {
    const token = generator.generate();
    expect(token).toMatch(BASE64URL_43);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
  });

  it("generates a different value each time", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generator.generate()));
    expect(tokens.size).toBe(20);
  });

  it("hashes deterministically with SHA-256 hex, differing from the raw value", () => {
    const token = generator.generate();
    const hash = generator.hash(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(generator.hash(token));
    expect(hash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(hash).not.toBe(token);
  });
});
