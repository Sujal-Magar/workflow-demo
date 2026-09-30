import { describe, expect, it } from "vitest";

import { ConfigError, DEFAULT_PASSWORD_HASHING_COST, loadConfig } from "./env";

const SECRET_32 = "a".repeat(32);

describe("loadConfig (T-UA-11)", () => {
  it("a missing JWT_SECRET → error naming JWT_SECRET and the rule", () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    expect(() => loadConfig({})).toThrow(/JWT_SECRET is required.*at least 32 characters/);
  });

  it("an empty JWT_SECRET counts as missing", () => {
    expect(() => loadConfig({ JWT_SECRET: "" })).toThrow(/JWT_SECRET is required/);
  });

  it("a 31-character JWT_SECRET → error naming JWT_SECRET and the length rule", () => {
    expect(() => loadConfig({ JWT_SECRET: "a".repeat(31) })).toThrow("JWT_SECRET must be at least 32 characters long.");
  });

  it("a 32-character JWT_SECRET passes", () => {
    expect(loadConfig({ JWT_SECRET: SECRET_32 }).jwtSecret).toBe(SECRET_32);
  });

  it.each([undefined, ""])("in production, GOOGLE_CLIENT_ID %j → error naming it", (googleClientId) => {
    expect(() =>
      loadConfig({ JWT_SECRET: SECRET_32, NODE_ENV: "production", GOOGLE_CLIENT_ID: googleClientId })
    ).toThrow("GOOGLE_CLIENT_ID is required when NODE_ENV=production.");
  });

  it("in production, a set GOOGLE_CLIENT_ID gives a production config", () => {
    const config = loadConfig({ JWT_SECRET: SECRET_32, NODE_ENV: "production", GOOGLE_CLIENT_ID: "client-id" });
    expect(config.isProduction).toBe(true);
    expect(config.nodeEnv).toBe("production");
    expect(config.googleClientId).toBe("client-id");
  });

  it.each([undefined, ""])(
    "outside production, GOOGLE_CLIENT_ID %j → valid config with Google unconfigured (A-8)",
    (googleClientId) => {
      const config = loadConfig({ JWT_SECRET: SECRET_32, NODE_ENV: "development", GOOGLE_CLIENT_ID: googleClientId });
      expect(config.googleClientId).toBeNull();
      expect(config.isProduction).toBe(false);
    }
  );

  it("applies the documented defaults", () => {
    const config = loadConfig({ JWT_SECRET: SECRET_32 });
    expect(config).toEqual({
      jwtSecret: SECRET_32,
      googleClientId: null,
      frontendOrigin: "http://localhost:3000",
      nodeEnv: null,
      isProduction: false,
      databasePath: "data/app.db",
      port: 4000,
      passwordHashingCost: DEFAULT_PASSWORD_HASHING_COST,
    });
  });

  it("explicit values override the defaults", () => {
    const config = loadConfig({
      JWT_SECRET: SECRET_32,
      FRONTEND_ORIGIN: "http://app.example.test",
      DATABASE_PATH: "/tmp/other.db",
      PORT: "5055",
      GOOGLE_CLIENT_ID: "dev-client",
    });
    expect(config.frontendOrigin).toBe("http://app.example.test");
    expect(config.databasePath).toBe("/tmp/other.db");
    expect(config.port).toBe(5055);
    expect(config.googleClientId).toBe("dev-client");
  });

  it.each(["abc", "0", "70000", "40.5"])("an invalid PORT %j → error naming PORT", (port) => {
    expect(() => loadConfig({ JWT_SECRET: SECRET_32, PORT: port })).toThrow(/^PORT must be an integer/);
  });
});
