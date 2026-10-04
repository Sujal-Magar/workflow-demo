"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { AlertCircleIcon, CheckCircleIcon, CloseIcon } from "./icons";

export const TOAST_DURATION_MS = 5000;

export type ToastVariant = "success" | "error";

/** `"solid"` is the app-wide default; `"banner"` is the light, icon-led, sliding look of the `transactions` toasts (D-33). */
export type ToastAppearance = "solid" | "banner";

export interface ToastOptions {
  /** Overrides `TOAST_DURATION_MS` for this toast only (D-32). */
  readonly durationMs?: number;
  readonly appearance?: ToastAppearance;
}

interface ToastItem {
  readonly id: number;
  readonly variant: ToastVariant;
  readonly message: string;
  readonly appearance: ToastAppearance;
}

export interface ToastApi {
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
}

interface ToastStyle {
  readonly container: string;
  readonly closeButton: string;
}

const TOAST_STYLES: Readonly<Record<ToastAppearance, Readonly<Record<ToastVariant, ToastStyle>>>> = {
  solid: {
    success: {
      container: "text-white bg-brand-teal",
      closeButton: "text-white/80 hover:text-white focus-visible:ring-white",
    },
    error: {
      container: "text-white bg-red-600",
      closeButton: "text-white/80 hover:text-white focus-visible:ring-white",
    },
  },
  banner: {
    success: {
      container: "bg-green-100 text-green-800 motion-safe:animate-toast-slide-in",
      closeButton: "text-green-800/70 hover:text-green-800 focus-visible:ring-green-800",
    },
    error: {
      container: "bg-red-100 text-red-800 motion-safe:animate-toast-slide-in",
      closeButton: "text-red-800/70 hover:text-red-800 focus-visible:ring-red-800",
    },
  },
};

interface ToastContentProps {
  readonly toast: ToastItem;
  readonly onDismiss: (id: number) => void;
}

/** Everything inside the toast's `role="alert"` / `<output>` element, shared by both roles. */
function ToastContent({ toast, onDismiss }: Readonly<ToastContentProps>) {
  const style = TOAST_STYLES[toast.appearance][toast.variant];
  const isBanner = toast.appearance === "banner";

  return (
    <>
      {isBanner && toast.variant === "success" ? <CheckCircleIcon className="h-5 w-5 shrink-0 text-green-500" /> : null}
      {isBanner && toast.variant === "error" ? <AlertCircleIcon className="h-5 w-5 shrink-0 text-red-500" /> : null}
      <p className="flex-1 leading-5">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className={cn(
          "-mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2",
          style.closeButton
        )}
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </>
  );
}

const TOAST_CONTAINER_BASE = "pointer-events-auto flex items-start gap-3 rounded-md px-4 py-3 text-sm shadow-lg";

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [toasts, setToasts] = useState<readonly ToastItem[]>([]);
  // Mirror of the visible toasts, so de-duplication and timers stay outside state updaters.
  const visibleToastsRef = useRef<readonly ToastItem[]>([]);
  const nextIdRef = useRef(1);
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    visibleToastsRef.current = visibleToastsRef.current.filter((toast) => toast.id !== id);
    setToasts(visibleToastsRef.current);
  }, []);

  const showToast = useCallback(
    (variant: ToastVariant, message: string, options: ToastOptions = {}) => {
      const isAlreadyVisible = visibleToastsRef.current.some(
        (toast) => toast.variant === variant && toast.message === message
      );
      if (isAlreadyVisible) {
        return;
      }
      const toast: ToastItem = {
        id: nextIdRef.current++,
        variant,
        message,
        appearance: options.appearance ?? "solid",
      };
      visibleToastsRef.current = [...visibleToastsRef.current, toast];
      timersRef.current.set(
        toast.id,
        setTimeout(() => dismissToast(toast.id), options.durationMs ?? TOAST_DURATION_MS)
      );
      setToasts(visibleToastsRef.current);
    },
    [dismissToast]
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, options) => showToast("success", message, options),
      error: (message, options) => showToast("error", message, options),
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
      >
        {toasts.map((toast) => {
          const containerClassName = cn(TOAST_CONTAINER_BASE, TOAST_STYLES[toast.appearance][toast.variant].container);
          if (toast.variant === "error") {
            return (
              <div key={toast.id} role="alert" className={containerClassName}>
                <ToastContent toast={toast} onDismiss={dismissToast} />
              </div>
            );
          }
          return (
            <output key={toast.id} className={containerClassName}>
              <ToastContent toast={toast} onDismiss={dismissToast} />
            </output>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside <ToastProvider>.");
  }
  return context;
}
