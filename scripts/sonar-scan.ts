#!/usr/bin/env node --experimental-strip-types
// ==============================================================================
// SonarQube Scanner Runner
//
// Reads credentials from environment variables or .env.sonar.local / .env.sonar
// and runs SonarQube scanner via npx sonarqube-scanner.
//
// Usage:
//   pnpm sonar:scan
//   node --experimental-strip-types scripts/sonar-scan.ts [extra scanner options]
// ==============================================================================

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(SCRIPT_DIR, "..");

function loadEnvVar(name: string): string {
  for (const file of [join(ROOT_DIR, ".env.sonar.local"), join(ROOT_DIR, ".env.sonar")]) {
    if (!existsSync(file)) continue;
    const line = readFileSync(file, "utf8")
      .split("\n")
      .find((l) => l.trim().startsWith(`${name}=`));
    if (line) {
      return line
        .slice(line.indexOf("=") + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "");
    }
  }
  return "";
}

const hostUrl = process.env.SONAR_HOST_URL || loadEnvVar("SONAR_HOST_URL") || "http://localhost:9000";
const token = process.env.SONAR_TOKEN || loadEnvVar("SONAR_TOKEN") || "";

console.log("============================================================");
console.log(" SonarQube Scanner Runner");
console.log("============================================================");
console.log(` Target Server : ${hostUrl}`);
console.log(` Auth Token    : ${token ? "[PROVIDED]" : "[NONE]"}`);
console.log("============================================================\n");

const env = {
  ...process.env,
  SONAR_HOST_URL: hostUrl,
  ...(token ? { SONAR_TOKEN: token } : {}),
};

const args = ["sonarqube-scanner", ...process.argv.slice(2)];

const child = spawn("npx", args, {
  cwd: ROOT_DIR,
  env,
  stdio: "inherit",
});

child.on("close", (code) => {
  process.exit(code ?? 0);
});
