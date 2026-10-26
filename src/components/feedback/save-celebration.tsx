"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CategoryIcon, formatWon } from "@/components/ledger/category-icon";

const COLORS = ["#ffd166", "#ff8fab", "#8ecae6", "#95d5b2", "#ffb4a2", "#cdb4db"];
const SHOW_MS = 1500;

type Celebration = { name: string; icon: string | null; amount: number };

function Inner() {
  const t = useTranslations("toast");
  const searchParams = useSearchParams();
  const saved = searchParams.get("saved");
  const [data, setData] = useState<Celebration | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const amount = Number(searchParams.get("sa"));
    setData({
      name: searchParams.get("sn") ?? "",
      icon: searchParams.get("si"),
      amount: Number.isFinite(amount) ? amount : 0,
    });
    setLeaving(false);
    const url = new URL(window.location.href);
    for (const key of ["saved", "sn", "si", "sa"]) url.searchParams.delete(key);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  useEffect(() => {
    if (!data) return;
    const out = setTimeout(() => setLeaving(true), SHOW_MS);
    const done = setTimeout(() => setData(null), SHOW_MS + 250);
    return () => {
      clearTimeout(out);
      clearTimeout(done);
    };
  }, [data]);

  const sparks = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const radius = 90 + ((i * 37) % 30);
        return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, color: COLORS[i % COLORS.length], delay: 0.2 + (i % 4) * 0.03 };
      }),
    []
  );
  const hearts = useMemo(
    () => Array.from({ length: 6 }, (_, i) => ({ left: 60 + i * 34, dx: ((i * 53) % 50) - 25, color: COLORS[i % COLORS.length], delay: 0.5 + i * 0.12 })),
    []
  );

  if (!data) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-0 z-[95] flex items-center justify-center bg-[rgba(40,25,18,0.38)] backdrop-blur-[2px] ${
        leaving ? "animate-[celebrate-fade-out_250ms_ease-in_forwards]" : "animate-[celebrate-fade-in_180ms_ease-out_both]"
      }`}
    >
      <div className="relative flex flex-col items-center gap-3.5">
        <div className="celebrate-badge relative grid size-[132px] place-items-center rounded-full bg-surface text-brand shadow-[0_14px_40px_rgba(242,107,58,0.35)]">
          <span className="celebrate-ring" />
          <span className="celebrate-ring" style={{ animationDelay: "0.45s" }} />
          <span className="celebrate-icon">
            <CategoryIcon category={{ name: data.name, icon: data.icon }} className="size-16" />
          </span>
          {sparks.map((s, i) => (
            <i
              key={i}
              className="celebrate-spark"
              style={{ ["--x" as string]: `${s.x}px`, ["--y" as string]: `${s.y}px`, background: s.color, animationDelay: `${s.delay}s` }}
            />
          ))}
        </div>
        <p className="celebrate-msg text-[22px] font-extrabold text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.25)]">
          {t("savedCelebrate")}
        </p>
        <p className="celebrate-amt text-[13px] text-white/90">
          {data.name} · {formatWon(data.amount)}
        </p>
        {hearts.map((h, i) => (
          <i
            key={i}
            className="celebrate-heart"
            style={{ left: h.left, ["--dx" as string]: `${h.dx}px`, color: h.color, animationDelay: `${h.delay}s` }}
          />
        ))}
      </div>
    </div>
  );
}

export function SaveCelebration() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
