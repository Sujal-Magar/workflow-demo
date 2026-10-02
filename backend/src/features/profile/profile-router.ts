import { createExpressEndpoints, initServer } from "@ts-rest/express";
import { profileContract } from "@workflow-demo/contracts";
import express, { type RequestHandler, type Router } from "express";

import { handleRequestValidationError } from "../../shared/http/validation-error";
import { getAuthenticatedUserId } from "../auth/require-auth";
import {
  DATA_CLEARED_MESSAGE,
  EXPORT_FILENAME_PREFIX,
  EXPORT_FILENAME_SUFFIX,
  PASSWORD_CHANGED_MESSAGE,
} from "./profile-constants";
import type { ProfileService } from "./profile-service";

export interface ProfileRouterDependencies {
  readonly profileService: ProfileService;
  readonly requireAuth: RequestHandler;
}

function exportFilename(now: Date): string {
  const isoDate = now.toISOString().slice(0, 10);
  return `${EXPORT_FILENAME_PREFIX}${isoDate}${EXPORT_FILENAME_SUFFIX}`;
}

/**
 * The five `profile` operations (contract §5–§6). Handlers stay thin: read the body or `userId`,
 * call the service, set the `Content-Disposition` header for `exportUserData`, and return the
 * declared status. Every route requires `requireAuth`. Routes carry their full
 * `/api/v1/profile/...` path from the typed contract, so the router is mounted without a prefix.
 */
export function createProfileRouter(dependencies: ProfileRouterDependencies): Router {
  const { profileService, requireAuth } = dependencies;
  const server = initServer();

  const routes = server.router(profileContract, {
    getUserProfile: {
      middleware: [requireAuth],
      handler: async ({ req }) => {
        const profile = await profileService.getProfile(getAuthenticatedUserId(req));
        return { status: 200, body: profile };
      },
    },
    updateUserProfile: {
      middleware: [requireAuth],
      handler: async ({ req, body }) => {
        const profile = await profileService.updateProfile(getAuthenticatedUserId(req), body);
        return { status: 200, body: profile };
      },
    },
    changePassword: {
      middleware: [requireAuth],
      handler: async ({ req, body }) => {
        await profileService.changePassword(getAuthenticatedUserId(req), body);
        return { status: 200, body: { success: true, message: PASSWORD_CHANGED_MESSAGE } };
      },
    },
    exportUserData: {
      middleware: [requireAuth],
      handler: async ({ req, res }) => {
        const profile = await profileService.exportProfileData(getAuthenticatedUserId(req));
        res.setHeader("Content-Disposition", `attachment; filename="${exportFilename(new Date())}"`);
        return { status: 200, body: profile };
      },
    },
    clearAllUserData: {
      middleware: [requireAuth],
      handler: async ({ req }) => {
        await profileService.clearAllUserData(getAuthenticatedUserId(req));
        return { status: 200, body: { success: true, message: DATA_CLEARED_MESSAGE } };
      },
    },
  });

  const router = express.Router();
  createExpressEndpoints(profileContract, routes, router, {
    requestValidationErrorHandler: handleRequestValidationError,
  });
  return router;
}
