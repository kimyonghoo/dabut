"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const variants = {
  enter: (direction: number) => ({ x: direction >= 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction >= 0 ? "-100%" : "100%", opacity: 0 }),
};

/**
 * Slides the month grid horizontally when `monthKey` (a "yyyy-MM" string)
 * changes — left for a later month, right for an earlier one — instead of
 * the blank gap a bare RSC navigation would otherwise show. The header and
 * prev/next controls live outside this component (see calendar/page.tsx)
 * so they never move.
 *
 * Direction is derived purely by comparing the new key against the
 * previous one, so it works identically whether the navigation came from
 * MonthView's swipe gesture or the header's prev/next arrows — both just
 * land here with a new `monthHref` month. This updates state during render
 * (the React-endorsed "adjust state when a prop changes" pattern) rather
 * than mutating a ref in render, so it stays correct even if this component
 * is render-invoked twice (e.g. React Strict Mode).
 *
 * Pairs with the caller wrapping its navigation in `startTransition` (see
 * month-nav-arrows.tsx and MonthView's handleDragEnd): that keeps the old
 * month's content mounted and visible while the new one streams in, which
 * is what gives AnimatePresence something to animate out instead of a
 * Suspense fallback replacing it instantly.
 */
export function MonthSlide({ monthKey, children }: { monthKey: string; children: ReactNode }) {
  const [current, setCurrent] = useState(monthKey);
  const [direction, setDirection] = useState(0);

  if (monthKey !== current) {
    setDirection(monthKey > current ? 1 : -1);
    setCurrent(monthKey);
  }

  return (
    <div className="relative overflow-hidden">
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div
          key={current}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.28, ease: "easeInOut" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
