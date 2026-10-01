import { z } from "zod";

/** Contract §2.1. No other field ever leaves the server. */
export const publicUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
});

/** Contract §2.2. Returned by every operation that starts or renews a session. */
export const sessionPayloadSchema = z.object({
  user: publicUserSchema,
  accessToken: z.string(),
  expiresIn: z.number().int(),
});

/** Contract §6.5 success body. */
export const currentUserResponseSchema = z.object({
  user: publicUserSchema,
});

/** Contract §2.3. */
export const successAckSchema = z.object({
  success: z.literal(true),
});

/** Contract §2.4. */
export const forgotPasswordAckSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

export type PublicUser = z.infer<typeof publicUserSchema>;
export type SessionPayload = z.infer<typeof sessionPayloadSchema>;
export type CurrentUserResponse = z.infer<typeof currentUserResponseSchema>;
export type SuccessAck = z.infer<typeof successAckSchema>;
export type ForgotPasswordAck = z.infer<typeof forgotPasswordAckSchema>;
