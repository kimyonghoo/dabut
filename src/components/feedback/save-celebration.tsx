"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { CELEBRATE_EVENT, type CelebrateDetail, type CelebrateMessage } from "./celebrate-bus";
import { CategoryIcon, formatWon } from "@/components/ledger/category-icon";

const COLORS = ["#ffd166", "#ff8fab", "#8ecae6", "#95d5b2", "#ffb4a2", "#cdb4db"];
const MIN_SHOW_MS = 1500;
const MAX_PENDING_MS = 15000;

type Celebration = CelebrateDetail;

function Inner() {
  const t = useTranslations("toast");
  const pathname = usePathname();
  const [data, setData] = useState<Celebration | null>(null);
  const [leaving, setLeaving] = useState(false);
  const pendingRef = useRef(false);
  const startedAtRef = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const finish = useCallback(() => {
    if (!pendingRef.current) return;
    pendingRef.current = false;
    clearTimers();
    const remaining = Math.max(0, MIN_SHOW_MS - (Date.now() - startedAtRef.current));
    timers.current.push(setTimeout(() => setLeaving(true), remaining));
    timers.current.push(setTimeout(() => setData(null), remaining + 250));
  }, []);

  useEffect(() => {
    function onMessage(event: Event) {
      const message = (event as CustomEvent<CelebrateMessage>).detail;
      if (message.kind === "start") {
        clearTimers();
        pendingRef.current = true;
        startedAtRef.current = Date.now();
        setData(message.detail);
        setLeaving(false);
        // 안전장치: 이동이 끝났다는 신호가 없어도 오래 붙잡아 두지 않는다.
        timers.current.push(setTimeout(finish, MAX_PENDING_MS));
      } else if (message.kind === "finish") {
        finish();
      } else {
        pendingRef.current = false;
        clearTimers();
        setData(null);
        setLeaving(false);
      }
    }
    window.addEventListener(CELEBRATE_EVENT, onMessage);
    return () => window.removeEventListener(CELEBRATE_EVENT, onMessage);
  }, [finish]);

  // 저장 후 가계부로 이동이 끝나면(경로가 /ledger 로 바뀌면) 효과를 마무리한다.
  useEffect(() => {
    if (pendingRef.current && pathname === "/ledger") finish();
  }, [pathname, finish]);

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
  return <Inner />;
}
