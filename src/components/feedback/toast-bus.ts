/**
 * Client-side toasts (no navigation): dispatches a window event the
 * <Toaster /> listens to. `key` is from the `toast` message namespace.
 */
export type ToastTone = "success" | "error";

export const TOAST_EVENT = "dabut:toast";

export type ToastDetail = { key: string; tone: ToastTone };

export function showToast(key: string, tone: ToastTone = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { key, tone } }));
}
