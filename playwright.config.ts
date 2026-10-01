import { defineConfig } from "@playwright/test";

const API_BASE_URL = "http://localhost:4000";
// Test-only signing secret (at least 32 characters); never used outside E2E.
const E2E_JWT_SECRET = "e2e-only-jwt-secret-not-for-production-use";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: [
    {
      command: "pnpm dev",
      cwd: "backend",
      port: 4000,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
      env: {
        DATABASE_PATH: "data/e2e-test.db",
        JWT_SECRET: E2E_JWT_SECRET,
        // Explicitly empty so a developer's `.env` value cannot leak in: E2E runs with Google unconfigured (D-11).
        GOOGLE_CLIENT_ID: "",
      },
    },
    {
      command: "pnpm dev",
      cwd: "frontend",
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
      env: {
        NEXT_PUBLIC_API_BASE_URL: API_BASE_URL,
        NEXT_PUBLIC_GOOGLE_CLIENT_ID: "",
      },
    },
  ],
});
