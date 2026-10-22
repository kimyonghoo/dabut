"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { CategoryIcon, formatWon } from "@/components/ledger/category-icon";
import { PaymentMethodIcon } from "@/components/ledger/payment-method-icon";
import { paymentBrandColor } from "@/components/ledger/payment-brand";
import type { ShareGroup } from "@/lib/ledger/stats";

const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];

type Props = {
  kind: "category" | "payment";
  groups: ShareGroup[];
  visible: number;
  otherLabel: string;
  closeLabel: string;
  backLabel: string;
  countLabel: string; // e.g. "{n}건" pattern with {n}
  emptyText: string;
};

function Icon({ kind, g, className }: { kind: Props["kind"]; g: ShareGroup; className: string }) {
  return kind === "category" ? (
    <CategoryIcon category={{ name: g.name, icon: g.icon }} className={className} />
  ) : (
    <PaymentMethodIcon icon={g.icon} name={g.name} className={className} />
  );
}

export function ShareDrilldown({ kind, groups, visible, otherLabel, closeLabel, backLabel, countLabel, emptyText }: Props) {
  // null = closed; "__other__" = list of remaining groups; otherwise a group id
  const [open, setOpen] = useState<string | null>(null);
  const [fromOther, setFromOther] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const top = groups.slice(0, visible);
  const rest = groups.slice(visible);
  const restTotal = rest.reduce((s, g) => s + g.amount, 0);
  const restPct = rest.reduce((s, g) => s + g.pct, 0);
  const rows: { id: string; g?: ShareGroup; amount: number; pct: number; name: string }[] = top.map((g) => ({
    id: g.id,
    g,
    amount: g.amount,
    pct: g.pct,
    name: g.name,
  }));
  if (rest.length > 0) rows.push({ id: "__other__", amount: restTotal, pct: restPct, name: `${otherLabel} (${rest.length})` });

  if (groups.length === 0) return <p className="py-4 text-center text-sm text-ink-muted">{emptyText}</p>;

  const colorFor = (g: ShareGroup | undefined, i: number) =>
    (kind === "payment" && g ? paymentBrandColor(g.name) : null) ?? SERIES_COLORS[i % SERIES_COLORS.length];

  const current = open && open !== "__other__" ? groups.find((g) => g.id === open) : undefined;
  const showOtherList = open === "__other__";

  const openRow = (id: string) => {
    setFromOther(false);
    setOpen(id);
  };

  const sheet =
    open !== null && mounted
      ? createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setOpen(null)}>
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-3xl bg-surface shadow-xl"
            >
              <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                {current && fromOther ? (
                  <button
                    type="button"
                    aria-label={backLabel}
                    onClick={() => setOpen("__other__")}
                    className="rounded-full p-1 text-ink-muted hover:bg-surface-2"
                  >
                    <ChevronLeft className="size-5" aria-hidden />
                  </button>
                ) : null}
                <div className="min-w-0 flex-1">
                  {current ? (
                    <p className="flex items-center gap-1.5 truncate text-sm font-extrabold text-ink">
                      <Icon kind={kind} g={current} className="size-4 shrink-0" />
                      <span className="truncate">{current.name}</span>
                    </p>
                  ) : (
                    <p className="truncate text-sm font-extrabold text-ink">
                      {otherLabel} ({rest.length})
                    </p>
                  )}
                  <p className="text-[11px] text-ink-muted tabular-nums">
                    {formatWon(current ? current.amount : restTotal)}
                    {current ? ` · ${countLabel.replace("{n}", String(current.txs.length))}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={closeLabel}
                  onClick={() => setOpen(null)}
                  className="rounded-full p-1 text-ink-muted hover:bg-surface-2"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <div className="overflow-y-auto px-4 py-2 pb-6">
                {showOtherList && (
                  <ul className="flex flex-col">
                    {rest.map((g) => (
                      <li key={g.id} className="border-b border-line last:border-none">
                        <button
                          type="button"
                          onClick={() => {
                            setFromOther(true);
                            setOpen(g.id);
                          }}
                          className="flex w-full items-center gap-2 py-3 text-left"
                        >
                          <Icon kind={kind} g={g} className="size-4 shrink-0" />
                          <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{g.name}</span>
                          <span className="shrink-0 text-xs text-ink-muted tabular-nums">
                            {formatWon(g.amount)} · {Math.round(g.pct)}%
                          </span>
                          <ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {current && (
                  <ul className="flex flex-col">
                    {current.txs.map((tx, i) => (
                      <li key={`${tx.date}-${i}`} className="flex items-center gap-2.5 border-b border-line py-2.5 last:border-none">
                        <span className="w-10 shrink-0 text-[11px] tabular-nums text-ink-muted">{tx.date.slice(5).replace("-", "/")}</span>
                        <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{tx.label}</span>
                        <span className="shrink-0 text-sm font-extrabold tabular-nums text-ink">{formatWon(tx.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <ul className="flex flex-col gap-1">
        {rows.map((item, i) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => openRow(item.id)}
              className="w-full rounded-lg px-1 py-1.5 text-left transition hover:bg-surface-2"
            >
              <div className="mb-1 flex items-center justify-between gap-2 text-xs font-bold">
                <span className="flex min-w-0 items-center gap-1.5 truncate">
                  {item.g && <Icon kind={kind} g={item.g} className="size-3.5 shrink-0" />}
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-0.5 text-ink-muted">
                  {formatWon(item.amount)} · {Math.round(item.pct)}%
                  <ChevronRight className="size-3.5" aria-hidden />
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-md bg-surface-2">
                <div className="h-full rounded-md" style={{ width: `${item.pct}%`, background: colorFor(item.g, i) }} />
              </div>
            </button>
          </li>
        ))}
      </ul>
      {sheet}
    </>
  );
}
