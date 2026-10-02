"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as Dialog from "@radix-ui/react-dialog";
import { useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { FormAlert } from "@/components/ui/form-alert";
import { CloseIcon } from "@/components/ui/icons";

import { useUpdateProfile } from "../hooks/use-update-profile";
import { applyFieldErrors } from "../lib/apply-field-errors";
import { editProfileFormSchema, type EditProfileFormValues } from "../mocks/profile-form-schemas.mock";
import type { UserProfile } from "../mocks/profile-types.mock";
import { AvatarCircle } from "./avatar-circle";

const EDIT_PROFILE_FIELDS = ["name", "avatarUrl"] as const;
const GENERIC_FAILURE_MESSAGE = "Couldn't update your profile. Please try again.";

interface EditProfileBodyProps {
  profile: UserProfile;
  onSaved: () => void;
}

function EditProfileBody({ profile, onSaved }: Readonly<EditProfileBodyProps>) {
  const { submitUpdateProfile, isPending } = useUpdateProfile();
  const [hasRequestFailed, setHasRequestFailed] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<EditProfileFormValues>({
    resolver: zodResolver(editProfileFormSchema),
    defaultValues: { name: profile.name, avatarUrl: profile.avatarUrl ?? "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const avatarUrlValue = watch("avatarUrl");

  const submitValidForm = async (values: EditProfileFormValues) => {
    // A blank Avatar URL field omits `avatarUrl` from the request entirely; it never sends "" (contract §2.3).
    const result = await submitUpdateProfile({
      name: values.name,
      ...(values.avatarUrl ? { avatarUrl: values.avatarUrl } : {}),
    });
    if (result.ok) {
      onSaved();
      return;
    }
    if (result.failure.kind === "field-errors") {
      applyFieldErrors(result.failure.fieldErrors, EDIT_PROFILE_FIELDS, setError);
      return;
    }
    setHasRequestFailed(true);
  };

  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    event.stopPropagation();
    setHasRequestFailed(false);
    void handleSubmit(submitValidForm)(event);
  };

  return (
    <form noValidate onSubmit={submitForm} className="mt-6 flex flex-col items-center gap-4">
      <AvatarCircle avatarUrl={avatarUrlValue || null} name={profile.name} size={72} />

      <div className="w-full">
        <label htmlFor="edit-profile-name" className="mb-1 block text-sm font-medium text-brand-ink">
          Display Name
        </label>
        <input
          id="edit-profile-name"
          className="h-11 w-full rounded-md border border-gray-300 px-3 text-[15px] text-brand-ink focus:border-brand-teal focus:outline-none focus:ring-1 focus:ring-brand-teal"
          aria-invalid={Boolean(errors.name) || undefined}
          {...register("name")}
        />
        <FieldError id="edit-profile-name-error" message={errors.name?.message} />
      </div>

      <div className="w-full">
        <label htmlFor="edit-profile-avatar-url" className="mb-1 block text-sm font-medium text-brand-ink">
          Avatar URL
        </label>
        <input
          id="edit-profile-avatar-url"
          className="h-11 w-full rounded-md border border-gray-300 px-3 text-[15px] text-brand-ink focus:border-brand-teal focus:outline-none focus:ring-1 focus:ring-brand-teal"
          aria-invalid={Boolean(errors.avatarUrl) || undefined}
          {...register("avatarUrl")}
        />
        <FieldError id="edit-profile-avatar-url-error" message={errors.avatarUrl?.message} />
      </div>

      {hasRequestFailed ? <FormAlert message={GENERIC_FAILURE_MESSAGE} /> : null}

      <Button type="submit" isLoading={isPending} className="mt-2 w-full">
        Save Changes
      </Button>
    </form>
  );
}

interface EditProfileDialogProps {
  profile: UserProfile;
}

export function EditProfileDialog({ profile }: Readonly<EditProfileDialogProps>) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <Button>Edit Profile</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white px-8 pb-8 pt-10 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.35)] focus:outline-none">
          <Dialog.Title className="text-center font-display text-2xl font-bold text-brand-ink">
            Edit Profile
          </Dialog.Title>
          <Dialog.Description className="sr-only">Update your display name and avatar.</Dialog.Description>
          {isOpen ? <EditProfileBody profile={profile} onSaved={() => setIsOpen(false)} /> : null}
          <Dialog.Close asChild>
            <button
              type="button"
              aria-label="Close"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
