import { z } from "zod";
import { describe, expect, it } from "vitest";

import { toFieldErrors, validationErrorBody } from "./validation-error";

describe("toFieldErrors (BE-04, T-UA-08)", () => {
  it("keeps only the first message per top-level field", () => {
    const schema = z.object({
      email: z.string().min(3, "first").email("second"),
      name: z.string().min(2, "short"),
    });
    const result = schema.safeParse({ email: "x", name: "a" });
    expect(result.success).toBe(false);
    expect(toFieldErrors(result.success ? null : result.error)).toEqual({ email: "first", name: "short" });
  });

  it("returns an empty map for a null error", () => {
    expect(toFieldErrors(null)).toEqual({});
  });

  it("ignores issues that are not tied to a named field", () => {
    const result = z.string().safeParse(42);
    expect(toFieldErrors(result.success ? null : result.error)).toEqual({});
  });

  it("builds the VALIDATION_ERROR body", () => {
    expect(validationErrorBody({ email: "Email is required." })).toEqual({
      code: "VALIDATION_ERROR",
      message: "Request validation failed.",
      fieldErrors: { email: "Email is required." },
    });
  });
});
