import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

import { createApp } from "../app";
import { loadConfig, type AppConfig, type PasswordHashingCost } from "../config/env";
import { IN_MEMORY_DATABASE_PATH, openDatabase, type DatabaseHandle } from "../db/client";
import { runMigrations } from "../db/migrate";
import { AuthPersistence } from "../features/auth/auth-persistence";
import { AuthService } from "../features/auth/auth-service";
import { PasswordResetService } from "../features/auth/password-reset-service";
import { JoseAccessTokenSigner } from "../features/auth/ports/access-token-signer";
import type { GoogleIdentity, GoogleTokenVerifier } from "../features/auth/ports/google-token-verifier";
import type { Mailer, PasswordResetMessage } from "../features/auth/ports/mailer";
import { Argon2PasswordHasher } from "../features/auth/ports/password-hasher";
import { CryptoTokenGenerator } from "../features/auth/ports/token-generator";
import { SessionIssuer } from "../features/auth/session-issuer";
import type { Clock } from "../shared/clock";

/** Shared test doubles and wiring for the backend Unit/API tests (plan §8.1 harness). */

export const TEST_JWT_SECRET = "test-secret-with-at-least-32-characters!";
export const TEST_FRONTEND_ORIGIN = "http://localhost:3000";
export const TEST_START_TIME = new Date("2026-09-30T12:00:00.000Z");

/** Test-only argon2 cost (plan §8.1: "Argon2 cost is lowered by test config only"). */
export const TEST_PASSWORD_HASHING_COST: PasswordHashingCost = { timeCost: 2, memoryCost: 1024, parallelism: 1 };

export const STRONG_PASSWORD = "abcdefg1!";
export const OTHER_STRONG_PASSWORD = "zyxwvut9?";

export function createTestConfig(env: Readonly<Record<string, string | undefined>> = {}): AppConfig {
  const config = loadConfig({ JWT_SECRET: TEST_JWT_SECRET, DATABASE_PATH: IN_MEMORY_DATABASE_PATH, ...env });
  return { ...config, passwordHashingCost: TEST_PASSWORD_HASHING_COST };
}

export class TestClock implements Clock {
  private current: Date;

  constructor(start: Date = TEST_START_TIME) {
    this.current = new Date(start.getTime());
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  advanceBy(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}

export class CapturingMailer implements Mailer {
  readonly messages: PasswordResetMessage[] = [];

  async sendPasswordResetLink(message: PasswordResetMessage): Promise<void> {
    this.messages.push(message);
  }

  /** The raw token carried by the most recent reset URL. */
  lastToken(): string {
    const latest = this.messages[this.messages.length - 1];
    return new URL(latest.resetUrl).searchParams.get("token") as string;
  }
}

/** Maps ID tokens to identities; any unknown token is invalid. Records every call. */
export class FakeGoogleVerifier implements GoogleTokenVerifier {
  readonly calls: string[] = [];
  private readonly identities = new Map<string, GoogleIdentity>();

  register(idToken: string, identity: Partial<GoogleIdentity> & Pick<GoogleIdentity, "googleId" | "email">): void {
    this.identities.set(idToken, { emailVerified: true, name: null, ...identity });
  }

  async verify(idToken: string): Promise<GoogleIdentity | null> {
    this.calls.push(idToken);
    return this.identities.get(idToken) ?? null;
  }
}

export function createTestDatabase(): DatabaseHandle {
  const handle = openDatabase(IN_MEMORY_DATABASE_PATH);
  runMigrations(handle.db);
  return handle;
}

export interface AuthTestContext {
  readonly database: DatabaseHandle;
  readonly config: AppConfig;
  readonly clock: TestClock;
  readonly mailer: CapturingMailer;
  readonly googleVerifier: FakeGoogleVerifier;
  readonly persistence: AuthPersistence;
  readonly passwordHasher: Argon2PasswordHasher;
  readonly tokenGenerator: CryptoTokenGenerator;
  readonly accessTokenSigner: JoseAccessTokenSigner;
  readonly authService: AuthService;
  readonly passwordResetService: PasswordResetService;
  close(): void;
}

/** Services wired exactly as `createApp` wires them, on a fresh migrated `:memory:` database. */
export function createAuthTestContext(): AuthTestContext {
  const database = createTestDatabase();
  const config = createTestConfig();
  const clock = new TestClock();
  const mailer = new CapturingMailer();
  const googleVerifier = new FakeGoogleVerifier();
  const persistence = new AuthPersistence(database.db);
  const passwordHasher = new Argon2PasswordHasher(config.passwordHashingCost);
  const tokenGenerator = new CryptoTokenGenerator();
  const accessTokenSigner = new JoseAccessTokenSigner(config.jwtSecret, clock);
  const sessionIssuer = new SessionIssuer({ accessTokenSigner, tokenGenerator, clock });
  const authService = new AuthService({
    persistence,
    passwordHasher,
    googleTokenVerifier: googleVerifier,
    sessionIssuer,
    tokenGenerator,
    clock,
  });
  const passwordResetService = new PasswordResetService({
    persistence,
    passwordHasher,
    tokenGenerator,
    mailer,
    clock,
    frontendOrigin: config.frontendOrigin,
  });
  return {
    database,
    config,
    clock,
    mailer,
    googleVerifier,
    persistence,
    passwordHasher,
    tokenGenerator,
    accessTokenSigner,
    authService,
    passwordResetService,
    close: () => database.connection.close(),
  };
}

export interface TestAppOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly mailer?: Mailer;
  readonly googleTokenVerifier?: GoogleTokenVerifier;
}

export interface TestApp {
  readonly baseUrl: string;
  readonly database: DatabaseHandle;
  readonly config: AppConfig;
  readonly clock: TestClock;
  readonly mailer: CapturingMailer;
  readonly googleVerifier: FakeGoogleVerifier;
  readonly accessTokenSigner: JoseAccessTokenSigner;
  close(): Promise<void>;
}

/** Runs `createApp` on an ephemeral port with a fresh database (plan §8.1: global `fetch`, no supertest). */
export async function startTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const database = createTestDatabase();
  const config = createTestConfig(options.env);
  const clock = new TestClock();
  const mailer = new CapturingMailer();
  const googleVerifier = new FakeGoogleVerifier();
  const app = createApp({
    config,
    db: database.db,
    clock,
    mailer: options.mailer ?? mailer,
    googleTokenVerifier: options.googleTokenVerifier ?? googleVerifier,
  });
  const server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    database,
    config,
    clock,
    mailer,
    googleVerifier,
    accessTokenSigner: new JoseAccessTokenSigner(config.jwtSecret, clock),
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      database.connection.close();
    },
  };
}

export interface JsonResponse {
  readonly status: number;
  readonly headers: Headers;
  readonly text: string;
  readonly body: unknown;
  readonly setCookies: string[];
}

export interface RequestOptions {
  readonly method?: string;
  readonly body?: unknown;
  /** Sent verbatim instead of JSON-encoding `body`. */
  readonly rawBody?: string;
  readonly cookie?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

export async function sendRequest(baseUrl: string, path: string, options: RequestOptions = {}): Promise<JsonResponse> {
  const headers: Record<string, string> = { ...options.headers };
  let requestBody: string | undefined;
  if (options.rawBody !== undefined) {
    requestBody = options.rawBody;
    headers["content-type"] ??= "application/json";
  } else if (options.body !== undefined) {
    requestBody = JSON.stringify(options.body);
    headers["content-type"] ??= "application/json";
  }
  if (options.cookie !== undefined) {
    headers.cookie = options.cookie;
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? (requestBody === undefined ? "GET" : "POST"),
    headers,
    body: requestBody,
  });
  const text = await response.text();
  const body: unknown = text === "" ? null : JSON.parse(text);
  return {
    status: response.status,
    headers: response.headers,
    text,
    body,
    setCookies: response.headers.getSetCookie(),
  };
}

/** The `name=value` pair of the `refresh_token` cookie in a response, or `null`. */
export function readRefreshCookieValue(response: JsonResponse): string | null {
  const setCookie = response.setCookies.find((cookie) => cookie.startsWith("refresh_token="));
  if (setCookie === undefined) {
    return null;
  }
  return setCookie.slice("refresh_token=".length).split(";")[0];
}

export function refreshCookieHeader(value: string): string {
  return `refresh_token=${value}`;
}

export function signUpBody(email: string, password: string = STRONG_PASSWORD): Record<string, string> {
  return { name: "Test User", email, password, confirmPassword: password };
}
