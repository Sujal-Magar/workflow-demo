import { fileURLToPath } from "node:url";

import { coverageConfigDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    passWithNoTests: true,
    coverage: {
      reporter: ["text", "lcov"],
      // Only the `src` tree is measured, matching `sonar.sources`; root config files are not application code.
      include: ["src/**"],
      // `src/app/layout.tsx` is a logic-free entry point excluded identically in Sonar (plan D-24).
      exclude: [...coverageConfigDefaults.exclude, "src/app/layout.tsx"],
    },
  },
});
