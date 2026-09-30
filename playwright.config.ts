import { defineConfig } from "@playwright/test";

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
      },
    },
    {
      command: "pnpm dev",
      cwd: "frontend",
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
});
