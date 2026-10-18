"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";
import { SwipeableTabs } from "@/components/navigation/swipeable-tabs";
import { TabBar, type TabKey } from "@/components/navigation/tab-bar";

export function resolveActiveTab(pathname: string): TabKey {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.includes("settings")) return "settings";
  if (segments.includes("ledger")) return "ledger";
  return "calendar";
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const activeTab = resolveActiveTab(pathname);

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col bg-bg">
      <main
        className="flex-1 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-[calc(env(safe-area-inset-bottom)+6.5rem)]"
      >
        <SwipeableTabs>{children}</SwipeableTabs>
      </main>
      <TabBar activeTab={activeTab} />
    </div>
  );
}
