// Shared form-control classes so every form looks the same.
//
// Font size is pinned at 16px (not smaller) on purpose: iOS Safari
// auto-zooms the whole page when a text input's computed font-size is
// under 16px, and the zoom doesn't always reset cleanly afterward — on an
// iPhone that reads as "the whole screen's proportions are broken" after
// tapping into any field. 16px is the documented threshold that disables
// that behavior.
export const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-base text-ink placeholder:text-ink-muted/70 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand-soft";

export const labelClass = "flex flex-col gap-1.5 text-sm font-medium text-ink-muted";

export const errorClass = "rounded-xl bg-expense/10 px-3 py-2 text-sm text-expense";
