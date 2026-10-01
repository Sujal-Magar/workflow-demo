import { SpinnerIcon } from "./icons";

export function FullPageLoader() {
  return (
    <output className="flex min-h-screen items-center justify-center bg-background">
      <SpinnerIcon className="h-8 w-8 text-brand-teal" />
      <span className="sr-only">Loading…</span>
    </output>
  );
}
