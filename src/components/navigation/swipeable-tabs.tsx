"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";

const TAB_ORDER = ["ledger", "calendar", "settings"] as const;

function tabIndex(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const idx = TAB_ORDER.findIndex((tab) => segments.includes(tab));
  return idx === -1 ? 0 : idx;
}

/**
 * A small enter animation when switching tabs (fades/slides in from the
 * direction of the tab you came from) — purely cosmetic, no gesture
 * involved. Swiping between tabs was removed: with swipe-to-delete and
 * swipe-to-change-month both live on these same screens, a third swipe
 * gesture for tab-switching caused too many misfires. Switching tabs is now
 * exclusively via the TabBar buttons.
 */
export function SwipeableTabs({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  // Remember the previous tab so the entering page slides in from the correct side.
  // (State derived during render — safe under StrictMode, unlike mutating refs.)
  const [nav, setNav] = useState({ path: pathname, direction: 0 });
  if (nav.path !== pathname) {
    const direction = Math.sign(tabIndex(pathname) - tabIndex(nav.path));
    setNav({ path: pathname, direction });
  }
  const direction = nav.path === pathname ? nav.direction : 0;

  return (
    <motion.div
      key={pathname}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * 28 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.8 }}
    >
      {children}
    </motion.div>
  );
}
