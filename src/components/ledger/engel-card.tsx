"use client";

import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { Card } from "@/components/ui/card";

export type EngelBandView = { key: string; range: string; label: string; desc: string };

type Props = {
  title: string;
  subtitle: string;
  panelTitle: string;
  helpLabel: string;
  emptyText: string;
  hint: string;
  pct: number | null;
  currentKey: string | null;
  bands: EngelBandView[];
  breakdown: { name: string; amountText: string }[];
};

export function EngelCard({ title, subtitle, panelTitle, helpLabel, emptyText, hint, pct, currentKey, bands, breakdown }: Props) {
  const [open, setOpen] = useState(false);
  const current = bands.find((b) => b.key === currentKey);
  return (
    <Card className="flex flex-col gap-0.5">
      <div className="relative flex items-center gap-1">
        <h3 className="text-sm font-extrabold text-ink">{title}</h3>
        <button
          type="button"
          aria-label={helpLabel}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="rounded-full p-0.5 text-ink-muted hover:text-ink"
        >
          <CircleHelp className="size-3.5" aria-hidden />
        </button>
        {open && (
          <div
            role="tooltip"
            className="absolute bottom-full left-0 z-20 mb-2 max-h-[60vh] w-[min(20rem,calc(100vw-3rem))] overflow-y-auto rounded-2xl border border-line bg-surface p-3 shadow-[0_8px_28px_rgba(0,0,0,0.18)]"
          >
            <p className="mb-2 text-xs font-extrabold text-ink">{panelTitle}</p>
            <ul className="flex flex-col gap-1.5">
              {bands.map((b) => (
                <li key={b.key} className={`rounded-lg px-2 py-1.5 ${b.key === currentKey ? "bg-brand-soft" : ""}`}>
                  <p className="text-xs font-bold text-ink">
                    {b.range} · {b.label}
                  </p>
                  <p className="text-[11px] text-ink-muted">{b.desc}</p>
                </li>
              ))}
            </ul>
            <span
              aria-hidden
              className="absolute -bottom-1.5 left-[4.6rem] size-3 rotate-45 border-b border-r border-line bg-surface"
            />
          </div>
        )}
      </div>
      <p className="mb-2 text-[11px] text-ink-muted">{subtitle}</p>
      {pct === null || !current ? (
        <p className="py-4 text-center text-sm text-ink-muted">{emptyText}</p>
      ) : (
        <>
          <p className="text-2xl font-extrabold tabular-nums text-ink">
            {pct}% <span className="text-base text-brand">{current.label}</span>
          </p>
          <p className="mt-1 text-[11px] text-ink-muted">{hint}</p>
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-ink-muted">
            {breakdown.map((b) => (
              <li key={b.name} className="flex justify-between">
                <span>{b.name}</span>
                <span className="tabular-nums text-ink">{b.amountText}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
