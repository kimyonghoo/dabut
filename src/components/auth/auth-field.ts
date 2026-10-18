// Minimal, underline-only field styling for the (auth) pages — deliberately
// distinct from the boxed inputs (src/components/ui/field.tsx) used by the
// rest of the app.
export const authFieldWrap = "flex flex-col gap-1.5";

export const authLabelClass = "text-[10px] font-semibold uppercase tracking-wider text-ink-muted";

// text-base (16px), not smaller: iOS Safari auto-zooms the whole page when a
// text input's font-size is under 16px, which doesn't always reset cleanly —
// on an iPhone that reads as "the whole screen's proportions are broken"
// after tapping into any field.
export const authInputClass =
  "w-full border-0 border-b-[1.5px] border-line bg-transparent px-0.5 py-2 text-base text-ink outline-none transition focus:border-brand";

export const authButtonClass =
  "w-full rounded-md bg-[#2c2320] py-3.5 text-[13.5px] font-bold tracking-wide text-[#fdf6f0] transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none dark:bg-surface-2 dark:text-ink";

export const authErrorClass = "text-[13px] text-expense";
