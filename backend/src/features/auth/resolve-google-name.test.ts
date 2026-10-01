import { describe, expect, it } from "vitest";

import { resolveGoogleName } from "./resolve-google-name";

describe("resolveGoogleName (T-UA-02)", () => {
  it("uses the trimmed name claim when it has at least 2 characters", () => {
    expect(resolveGoogleName("  Piyush Sharma  ", "piyush@example.com")).toBe("Piyush Sharma");
    expect(resolveGoogleName("Al", "al@example.com")).toBe("Al");
  });

  it("falls back to the email local part when the name claim is missing", () => {
    expect(resolveGoogleName(null, "jane.doe@example.com")).toBe("jane.doe");
  });

  it('falls back to the local part when the trimmed name has 1 character (" A ")', () => {
    expect(resolveGoogleName(" A ", "jane@example.com")).toBe("jane");
  });

  it("falls back to the local part for a whitespace-only name", () => {
    expect(resolveGoogleName("   ", "jo@example.com")).toBe("jo");
  });

  it('uses "User" when there is no usable name and the local part has 1 character', () => {
    expect(resolveGoogleName(null, "j@example.com")).toBe("User");
    expect(resolveGoogleName("B", "j@example.com")).toBe("User");
  });

  it("treats an address without @ as all local part", () => {
    expect(resolveGoogleName(null, "localonly")).toBe("localonly");
  });
});
