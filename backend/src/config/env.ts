export const DEFAULT_FRONTEND_ORIGIN = "http://localhost:3000";
export const DEFAULT_DATABASE_PATH = "data/app.db";
export const DEFAULT_PORT = 4000;
export const JWT_SECRET_MIN_LENGTH = 32;
const PRODUCTION_ENV = "production";
const MAX_PORT = 65535;

/** argon2id cost parameters. Production uses the library defaults; only tests may lower them. */
export interface PasswordHashingCost {
  readonly timeCost: number;
  readonly memoryCost: number;
  readonly parallelism: number;
}

export const DEFAULT_PASSWORD_HASHING_COST: PasswordHashingCost = {
  timeCost: 3,
  memoryCost: 65536,
  parallelism: 4,
};

export interface AppConfig {
  readonly jwtSecret: string;
  /** `null` when Google sign-in is not configured (unset or empty `GOOGLE_CLIENT_ID`). */
  readonly googleClientId: string | null;
  readonly frontendOrigin: string;
  readonly nodeEnv: string | null;
  readonly isProduction: boolean;
  readonly databasePath: string;
  readonly port: number;
  readonly passwordHashingCost: PasswordHashingCost;
}

export type EnvironmentVariables = Readonly<Record<string, string | undefined>>;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/** Empty values count as unset, so an explicitly empty variable never overrides a default or satisfies a requirement. */
function readVariable(env: EnvironmentVariables, name: string): string | null {
  const value = env[name];
  return value === undefined || value === "" ? null : value;
}

function readJwtSecret(env: EnvironmentVariables): string {
  const jwtSecret = readVariable(env, "JWT_SECRET");
  if (jwtSecret === null) {
    throw new ConfigError("JWT_SECRET is required. Set it to a secret of at least 32 characters.");
  }
  if (jwtSecret.length < JWT_SECRET_MIN_LENGTH) {
    throw new ConfigError(`JWT_SECRET must be at least ${JWT_SECRET_MIN_LENGTH} characters long.`);
  }
  return jwtSecret;
}

function readGoogleClientId(env: EnvironmentVariables, isProduction: boolean): string | null {
  const googleClientId = readVariable(env, "GOOGLE_CLIENT_ID");
  if (googleClientId === null && isProduction) {
    throw new ConfigError("GOOGLE_CLIENT_ID is required when NODE_ENV=production.");
  }
  return googleClientId;
}

function readPort(env: EnvironmentVariables): number {
  const rawPort = readVariable(env, "PORT");
  if (rawPort === null) {
    return DEFAULT_PORT;
  }
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) {
    throw new ConfigError(`PORT must be an integer between 1 and ${MAX_PORT}, received "${rawPort}".`);
  }
  return port;
}

/**
 * Validates the environment and returns the typed configuration.
 * Throws a `ConfigError` whose message names the failing variable and rule.
 */
export function loadConfig(env: EnvironmentVariables): AppConfig {
  const nodeEnv = readVariable(env, "NODE_ENV");
  const isProduction = nodeEnv === PRODUCTION_ENV;

  return {
    jwtSecret: readJwtSecret(env),
    googleClientId: readGoogleClientId(env, isProduction),
    frontendOrigin: readVariable(env, "FRONTEND_ORIGIN") ?? DEFAULT_FRONTEND_ORIGIN,
    nodeEnv,
    isProduction,
    databasePath: readVariable(env, "DATABASE_PATH") ?? DEFAULT_DATABASE_PATH,
    port: readPort(env),
    passwordHashingCost: DEFAULT_PASSWORD_HASHING_COST,
  };
}
