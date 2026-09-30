import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TOAST_DURATION_MS, ToastProvider, useToast, type ToastApi } from "./toast";

let toastApi: ToastApi | null = null;

function ToastProbe() {
  toastApi = useToast();
  return null;
}

function toast(): ToastApi {
  if (!toastApi) {
    throw new Error("ToastProvider has not rendered yet");
  }
  return toastApi;
}

function renderToasts() {
  return render(
    <ToastProvider>
      <ToastProbe />
    </ToastProvider>
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  toastApi = null;
});

describe("T-UI-11 · Toast system", () => {
  it("renders an error toast as an alert and a success toast as a status inside a live region", () => {
    renderToasts();

    act(() => {
      toast().error("Something failed.");
      toast().success("Password updated. Please sign in.");
    });

    const alert = screen.getByRole("alert");
    const status = screen.getByRole("status");
    expect(alert).toHaveTextContent("Something failed.");
    expect(alert).toHaveClass("bg-red-600");
    expect(status).toHaveTextContent("Password updated. Please sign in.");
    expect(status).toHaveClass("bg-brand-teal");
    expect(alert.parentElement).toHaveAttribute("aria-live", "polite");
  });

  it("auto-dismisses after about 5 seconds", () => {
    vi.useFakeTimers();
    renderToasts();

    act(() => toast().error("Temporary message."));
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 1));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(TOAST_DURATION_MS).toBe(5000);
  });

  it("closes a toast with its close button", () => {
    renderToasts();

    act(() => toast().success("Closable."));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not show an identical visible message twice, but shows it again once dismissed", () => {
    vi.useFakeTimers();
    renderToasts();

    act(() => {
      toast().error("Duplicate.");
      toast().error("Duplicate.");
    });
    expect(screen.getAllByRole("alert")).toHaveLength(1);

    act(() => toast().success("Duplicate."));
    expect(screen.getByRole("status")).toHaveTextContent("Duplicate.");

    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS));
    act(() => toast().error("Duplicate."));
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("clears pending timers on unmount", () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const { unmount } = renderToasts();
    act(() => toast().error("Pending."));

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it("throws when used outside ToastProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<ToastProbe />)).toThrow("useToast must be used inside <ToastProvider>.");
  });
});
