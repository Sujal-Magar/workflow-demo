// Form-only validation for the Edit Profile dialog (plan FE-04, INT-01). `avatarUrlSchema` from the contract
// package rejects an explicit empty string (contract §2.3), but the dialog itself must let the field be blank —
// a blank Avatar URL is a valid "leave unchanged" value at the form layer; `edit-profile-dialog.tsx` is the one
// that omits it from the request body entirely rather than ever sending "".
import { z } from "zod";

import { avatarUrlSchema, displayNameSchema } from "@workflow-demo/contracts";

export const editProfileFormSchema = z.object({
  name: displayNameSchema,
  avatarUrl: z.union([avatarUrlSchema, z.literal("")]),
});

export type EditProfileFormValues = z.input<typeof editProfileFormSchema>;
