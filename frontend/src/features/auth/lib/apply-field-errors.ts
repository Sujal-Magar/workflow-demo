import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import type { FieldErrors } from "./auth-error";

/**
 * Puts each server `fieldErrors` entry onto the matching form field and focuses the first one.
 * Keys with no form field (for example `token` on the reset form) are ignored.
 */
export function applyFieldErrors<TFieldValues extends FieldValues>(
  fieldErrors: FieldErrors,
  formFields: readonly Path<TFieldValues>[],
  setError: UseFormSetError<TFieldValues>
): void {
  let hasFocused = false;
  for (const field of formFields) {
    const message = fieldErrors[field];
    if (typeof message !== "string") {
      continue;
    }
    setError(field, { type: "server", message }, { shouldFocus: !hasFocused });
    hasFocused = true;
  }
}
