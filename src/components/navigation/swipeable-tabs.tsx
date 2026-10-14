"use client";

import { motion, type PanInfo } from "framer-motion";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { resolveSwipeDirection } from "./resolve-swipe-direction";

export function SwipeableTabs({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  function handleDragEnd(_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    const dir = resolveSwipeDirection(info.offset.x, info.velocity.x);
    if (dir === "next" && pathname.endsWith("/calendar")) router.push("/ledger");
    if (dir === "prev" && pathname.endsWith("/ledger")) router.push("/calendar");
  }

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragEnd={handleDragEnd}
    >
      {children}
    </motion.div>
  );
}
