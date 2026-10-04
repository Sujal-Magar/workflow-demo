import type { ToastOptions } from "@/components/ui/toast";

/** `fds.md` §4: "Toasts auto-dismiss after 4000ms" (D-32). Every other feature keeps `TOAST_DURATION_MS`. */
export const TRANSACTION_TOAST_DURATION_MS = 4000;

/** Passed on every `transactions` toast: 4000 ms and the light, sliding banner look (D-32, D-33). */
export const TRANSACTION_TOAST_OPTIONS: ToastOptions = {
  durationMs: TRANSACTION_TOAST_DURATION_MS,
  appearance: "banner",
};
