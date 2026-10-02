"use client";

import { useState } from "react";

import { UserIcon } from "@/components/ui/icons";

interface AvatarCircleProps {
  avatarUrl: string | null;
  name: string;
  size?: number;
}

/** Image when `avatarUrl` is set and loads; an initials/placeholder circle otherwise. */
export function AvatarCircle({ avatarUrl, name, size = 96 }: Readonly<AvatarCircleProps>) {
  const [hasErrored, setHasErrored] = useState(false);
  const dimension = `${size}px`;

  if (avatarUrl && !hasErrored) {
    return (
      // `avatarUrl` is arbitrary user-entered text (D-03), not a static/optimizable asset, so a plain <img> is used.
      <img
        src={avatarUrl}
        alt={`${name}'s avatar`}
        className="rounded-full object-cover"
        style={{ width: dimension, height: dimension }}
        onError={() => setHasErrored(true)}
      />
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-full bg-slate-100 text-slate-400"
      style={{ width: dimension, height: dimension }}
      aria-hidden="true"
    >
      <UserIcon style={{ width: size * 0.5, height: size * 0.5 }} />
    </div>
  );
}
