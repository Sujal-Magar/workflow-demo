import path from "node:path";

import { createApp } from "./app";
import { loadConfig, type AppConfig } from "./config/env";
import { openDatabase } from "./db/client";
import { runMigrations } from "./db/migrate";
import { GoogleAuthLibraryTokenVerifier } from "./features/auth/ports/google-token-verifier";
import { ConsoleMailer } from "./features/auth/ports/mailer";
import { systemClock } from "./shared/clock";

if (typeof process.loadEnvFile === "function") {
  const possibleEnvPaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "../.env"),
    path.resolve(__dirname, "../../.env"),
  ];
  for (const envPath of possibleEnvPaths) {
    try {
      process.loadEnvFile(envPath);
      break;
    } catch {
      // try next path
    }
  }
}

function loadConfigOrExit(): AppConfig {
  try {
    return loadConfig(process.env);
  } catch (error) {
    console.error(`Invalid configuration: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

const config = loadConfigOrExit();

const { db } = openDatabase(config.databasePath);
runMigrations(db);

const app = createApp({
  config,
  db,
  clock: systemClock,
  mailer: new ConsoleMailer(),
  googleTokenVerifier: new GoogleAuthLibraryTokenVerifier(config.googleClientId),
});

app.listen(config.port, () => {
  console.log(`Backend listening on port ${config.port}`);
});
