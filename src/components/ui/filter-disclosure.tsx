"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

/**
 * Collapsed-by-default wrapper for a search/filter UI block (search input +
 * chip rows). Starts collapsed to a single compact toggle chip so it doesn't
 * dominate the top of the screen before any real content; tapping it expands
 * the full controls, tapping again collapses them. Collapsing never clears
 * whatever filters/search text are already active — it only hides the
 * controls, since the state lives in the parent, not in here — and a small
 * count badge on the toggle shows that something is still filtered while
 * collapsed.
 */
export function FilterDisclosure({
  label,
  activeCount,
  children,
}: {
  label: string;
  /** Number of non-default filters/search currently active; 0 hides the badge. */
  activeCount: number;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const highlighted = expanded || activeCount > 0;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className={`inline-flex w-fit shrink-0 items-center gap-1.5 self-start rounded-full border px-3.5 py-2 text-sm font-medium transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
          highlighted
            ? "border-brand bg-brand-soft text-brand-strong"
            : "border-line bg-surface text-ink hover:bg-surface-2"
        }`}
      >
        <SlidersHorizontal aria-hidden className="size-4" />
        {label}
        {activeCount > 0 && (
          <span
            aria-hidden
            className="grid size-4 place-items-center rounded-full bg-brand text-[10px] font-bold leading-none text-white"
          >
            {activeCount}
          </span>
        )}
        <ChevronDown aria-hidden className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && <div className="flex flex-col gap-2">{children}</div>}
    </div>
  );
}
