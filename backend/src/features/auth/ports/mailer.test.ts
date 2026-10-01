import { afterEach, describe, expect, it, vi } from "vitest";

import { ConsoleMailer } from "./mailer";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ConsoleMailer (T-UA-02)", () => {
  it("logs a line containing the reset URL", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const resetUrl = "http://localhost:3000/reset-password?token=abc";

    await new ConsoleMailer().sendPasswordResetLink({ email: "a@b.co", resetUrl });

    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0]?.[0])).toContain(resetUrl);
  });
});
