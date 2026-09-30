"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { CloseIcon } from "./icons";

export const TOAST_DURATION_MS = 5000;

export type ToastVariant = "success" | "error";

interface ToastItem {
  readonly id: number;
  readonly variant: ToastVariant;
  readonly message: string;
}

export interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
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
    (variant: ToastVariant, message: string) => {
      const isAlreadyVisible = visibleToastsRef.current.some(
        (toast) => toast.variant === variant && toast.message === message
      );
      if (isAlreadyVisible) {
        return;
      }
      const toast: ToastItem = { id: nextIdRef.current++, variant, message };
      visibleToastsRef.current = [...visibleToastsRef.current, toast];
      timersRef.current.set(
        toast.id,
        setTimeout(() => dismissToast(toast.id), TOAST_DURATION_MS)
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
      success: (message) => showToast("success", message),
      error: (message) => showToast("error", message),
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
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.variant === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-md px-4 py-3 text-sm text-white shadow-lg",
              toast.variant === "error" ? "bg-red-600" : "bg-brand-teal"
            )}
          >
            <p className="flex-1 leading-5">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="-mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
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
