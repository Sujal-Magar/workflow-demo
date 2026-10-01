import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    passWithNoTests: true,
    coverage: {
      reporter: ["text", "lcov"],
      exclude: [...coverageConfigDefaults.exclude, "src/index.ts"],
    },
  },
});
