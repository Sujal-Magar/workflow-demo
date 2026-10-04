import cookieParser from "cookie-parser";
import express, { type Express, type NextFunction, type Request, type RequestHandler, type Response } from "express";

import type { AppConfig } from "./config/env";
import type { AppDatabase } from "./db/client";
import { AuthPersistence } from "./features/auth/auth-persistence";
import { createAuthRouter } from "./features/auth/auth-router";
import { AuthService } from "./features/auth/auth-service";
import { PasswordResetService } from "./features/auth/password-reset-service";
import { JoseAccessTokenSigner } from "./features/auth/ports/access-token-signer";
import type { GoogleTokenVerifier } from "./features/auth/ports/google-token-verifier";
import type { Mailer } from "./features/auth/ports/mailer";
import { Argon2PasswordHasher } from "./features/auth/ports/password-hasher";
import { CryptoTokenGenerator } from "./features/auth/ports/token-generator";
import { createRequireAuth } from "./features/auth/require-auth";
import { SessionIssuer } from "./features/auth/session-issuer";
import { ProfilePersistence } from "./features/profile/profile-persistence";
import { createProfileRouter } from "./features/profile/profile-router";
import { ProfileService } from "./features/profile/profile-service";
import { createTransactionRouter } from "./features/transactions/transaction-router";
import { TransactionRepository } from "./features/transactions/transaction-repository";
import { TransactionService } from "./features/transactions/transaction-service";
import type { Clock } from "./shared/clock";
import { errorHandler, notFoundHandler } from "./shared/errors/error-handler";

const JSON_BODY_LIMIT = "100kb";
const HTTP_NO_CONTENT = 204;
const CORS_ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const CORS_ALLOWED_HEADERS = "Content-Type, Authorization";

/** Everything the app needs from outside. Tests inject an in-memory database, a clock, a mailer and a Google verifier. */
export interface AppDependencies {
  readonly config: AppConfig;
  readonly db: AppDatabase;
  readonly clock: Clock;
  readonly mailer: Mailer;
  readonly googleTokenVerifier: GoogleTokenVerifier;
}

/** Contract §8: exactly one allowed origin, credentials allowed, preflight answered with 204. */
function createCorsMiddleware(frontendOrigin: string): RequestHandler {
  return (request: Request, response: Response, next: NextFunction): void => {
    response.setHeader("Access-Control-Allow-Origin", frontendOrigin);
    response.vary("Origin");
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Access-Control-Allow-Methods", CORS_ALLOWED_METHODS);
    response.setHeader("Access-Control-Allow-Headers", CORS_ALLOWED_HEADERS);
    if (request.method === "OPTIONS") {
      response.sendStatus(HTTP_NO_CONTENT);
      return;
    }
    next();
  };
}

/** Builds the Express app without listening, so tests can start it on an ephemeral port. */
export function createApp(dependencies: AppDependencies): Express {
  const { config, db, clock, mailer, googleTokenVerifier } = dependencies;

  const persistence = new AuthPersistence(db);
  const passwordHasher = new Argon2PasswordHasher(config.passwordHashingCost);
  const tokenGenerator = new CryptoTokenGenerator();
  const accessTokenSigner = new JoseAccessTokenSigner(config.jwtSecret, clock);
  const sessionIssuer = new SessionIssuer({ accessTokenSigner, tokenGenerator, clock });

  const authService = new AuthService({
    persistence,
    passwordHasher,
    googleTokenVerifier,
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

  const profilePersistence = new ProfilePersistence(db);
  const profileService = new ProfileService({
    profilePersistence,
    authPersistence: persistence,
    passwordHasher,
    clock,
  });

  const transactionRepository = new TransactionRepository(db);
  const transactionService = new TransactionService({ transactionRepository, clock });

  const app = express();
  app.use(createCorsMiddleware(config.frontendOrigin));
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(cookieParser());

  app.get("/health", (req, res) => {
    res.json({ status: "ok", message: "ok" });
  });

  app.use(
    createAuthRouter({
      authService,
      passwordResetService,
      requireAuth: createRequireAuth(accessTokenSigner),
      isSecureCookie: config.isProduction,
    })
  );
  app.use(
    createProfileRouter({
      profileService,
      requireAuth: createRequireAuth(accessTokenSigner),
    })
  );
  app.use(
    createTransactionRouter({
      transactionService,
      requireAuth: createRequireAuth(accessTokenSigner),
    })
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
