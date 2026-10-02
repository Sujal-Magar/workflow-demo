import { initContract } from "@ts-rest/core";

import { errorBodySchema } from "../common/error-body";
import { profileSuccessAckSchema, userProfileSchema } from "./profile-shapes";
import {
  changePasswordRequestSchema,
  clearAllUserDataRequestSchema,
  updateUserProfileRequestSchema,
} from "./profile-validation";

export const PROFILE_BASE_PATH = "/api/v1/profile";

const c = initContract();

/**
 * The five `profile` operations (contract.md §5–§6). Every route carries the full
 * `/api/v1/profile/...` path, and every status an operation may return is declared.
 */
export const profileContract = c.router(
  {
    getUserProfile: {
      method: "GET",
      path: "/",
      responses: {
        200: userProfileSchema,
        401: errorBodySchema,
        500: errorBodySchema,
      },
      summary: "Read the caller's full profile",
    },
    updateUserProfile: {
      method: "PATCH",
      path: "/",
      body: updateUserProfileRequestSchema,
      responses: {
        200: userProfileSchema,
        400: errorBodySchema,
        401: errorBodySchema,
        500: errorBodySchema,
      },
      summary: "Edit display name, avatar, and/or notification toggles",
    },
    changePassword: {
      method: "POST",
      path: "/change-password",
      body: changePasswordRequestSchema,
      responses: {
        200: profileSuccessAckSchema,
        400: errorBodySchema,
        401: errorBodySchema,
        429: errorBodySchema,
        500: errorBodySchema,
      },
      summary: "Update the caller's login password",
    },
    exportUserData: {
      method: "GET",
      path: "/export",
      responses: {
        200: userProfileSchema,
        401: errorBodySchema,
        500: errorBodySchema,
      },
      summary: "Download the caller's profile-owned data (D-01 scope)",
    },
    clearAllUserData: {
      method: "POST",
      path: "/clear-data",
      body: clearAllUserDataRequestSchema,
      responses: {
        200: profileSuccessAckSchema,
        400: errorBodySchema,
        401: errorBodySchema,
        500: errorBodySchema,
      },
      summary: "Reset profile configuration to baseline (D-01 scope)",
    },
  },
  {
    pathPrefix: PROFILE_BASE_PATH,
    strictStatusCodes: true,
  }
);

export type ProfileContract = typeof profileContract;
