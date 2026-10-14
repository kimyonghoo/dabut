"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";
import { SwipeableTabs } from "@/components/navigation/swipeable-tabs";
import { TabBar } from "@/components/navigation/tab-bar";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const activeTab = pathname.endsWith("/ledger") ? "ledger" : "calendar";

  return (
    <>
      <SwipeableTabs>{children}</SwipeableTabs>
      <TabBar activeTab={activeTab} />
    </>
  );
}
