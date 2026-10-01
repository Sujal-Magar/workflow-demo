import { afterEach, describe, expect, it, vi } from "vitest";

import { systemClock } from "./clock";

afterEach(() => {
  vi.useRealTimers();
});

describe("systemClock", () => {
  it("returns the current system time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T08:15:00.000Z"));
    expect(systemClock.now()).toEqual(new Date("2026-09-30T08:15:00.000Z"));
  });
});
