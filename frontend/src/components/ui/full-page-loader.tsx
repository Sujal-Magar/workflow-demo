import { SpinnerIcon } from "./icons";

export function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background" role="status">
      <SpinnerIcon className="h-8 w-8 text-brand-teal" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
