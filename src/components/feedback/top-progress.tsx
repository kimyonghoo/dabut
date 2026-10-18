"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { resetProgress, startProgress, subscribeProgress } from "./progress-store";

/**
 * 다붓 top progress bar: a brand → partner gradient (two colors snuggled
 * together) with a small heart riding the tip. Starts on internal link
 * clicks, form submits (via SubmitButton) and useProgressRouter pushes;
 * finishes when the route lands.
 */
// Many navigations (e.g. a locale switch replaying an already-cached route)
// land in well under this; holding off showing the bar until a navigation
// has actually run this long avoids a bar that blinks on and off almost
// instantly, which reads as a flicker in its own right.
const SHOW_DELAY_MS = 150;

function TopProgressInner() {
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const trickle = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const hide = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    return subscribeProgress((active) => {
      clearTimeout(hide.current);
      if (active) {
        clearTimeout(show.current);
        show.current = setTimeout(() => {
          setVisible(true);
          setWidth((w) => (w > 0 && w < 90 ? w : 8));
        }, SHOW_DELAY_MS);
        clearInterval(trickle.current);
        trickle.current = setInterval(() => {
          setWidth((w) => (w >= 90 ? w : w + (90 - w) * 0.12));
        }, 180);
      } else {
        // Navigation finished before it ever became visible: cancel the
        // pending show and skip the bar entirely for this one.
        clearTimeout(show.current);
        clearInterval(trickle.current);
        setWidth(100);
        hide.current = setTimeout(() => {
          setVisible(false);
          setWidth(0);
        }, 350);
      }
    });
  }, []);

  // Route landed → finish.
  useEffect(() => {
    resetProgress();
  }, [pathname, searchParams]);

  // Internal <a> clicks start the bar immediately.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      startProgress();
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 300ms ease" }}
    >
      <div
        className="relative h-full rounded-r-full"
        style={{
          width: `${width}%`,
          transition: "width 200ms ease-out",
          background: "linear-gradient(90deg, var(--color-partner), var(--color-brand))",
          boxShadow: "0 0 10px var(--color-brand-soft), 0 0 4px var(--color-brand)",
        }}
      >
        <Heart aria-hidden className="absolute -right-2 -top-[5px] size-3 fill-current text-brand animate-pulse" strokeWidth={2} />
      </div>
    </div>
  );
}

export function TopProgress() {
  return (
    <Suspense fallback={null}>
      <TopProgressInner />
    </Suspense>
  );
}
