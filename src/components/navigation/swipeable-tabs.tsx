"use client";

import { motion, useReducedMotion, type PanInfo } from "framer-motion";
import { useState, type ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";
import { useProgressRouter } from "@/components/feedback/use-progress-router";
import { resolveSwipeDirection } from "./resolve-swipe-direction";

const TAB_ORDER = ["calendar", "ledger", "settings"] as const;

function tabIndex(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const idx = TAB_ORDER.findIndex((tab) => segments.includes(tab));
  return idx === -1 ? 0 : idx;
}

export function SwipeableTabs({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useProgressRouter();
  const reduceMotion = useReducedMotion();

  // Remember the previous tab so the entering page slides in from the correct side.
  // (State derived during render — safe under StrictMode, unlike mutating refs.)
  const [nav, setNav] = useState({ path: pathname, direction: 0 });
  if (nav.path !== pathname) {
    const direction = Math.sign(tabIndex(pathname) - tabIndex(nav.path));
    setNav({ path: pathname, direction });
  }
  const direction = nav.path === pathname ? nav.direction : 0;

  // Swiping only moves between the two main tabs (calendar <-> ledger).
  const swipeable = pathname.endsWith("/calendar") || pathname.endsWith("/ledger");

  function handleDragEnd(_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    const dir = resolveSwipeDirection(info.offset.x, info.velocity.x);
    if (dir === "next" && pathname.endsWith("/calendar")) router.push("/ledger");
    if (dir === "prev" && pathname.endsWith("/ledger")) router.push("/calendar");
  }

  return (
    <motion.div
      key={pathname}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * 28 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.8 }}
      drag={swipeable ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      dragDirectionLock
      onDragEnd={handleDragEnd}
      className="touch-pan-y"
    >
      {children}
    </motion.div>
  );
}
