"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { CalendarHeart, Settings, Wallet, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";

export type TabKey = "calendar" | "ledger" | "settings";

const TABS: Array<{ key: TabKey; href: string; Icon: LucideIcon }> = [
  { key: "calendar", href: "/calendar", Icon: CalendarHeart },
  { key: "ledger", href: "/ledger", Icon: Wallet },
  { key: "settings", href: "/settings", Icon: Settings },
];

export function TabBar({ activeTab }: { activeTab: TabKey }) {
  const t = useTranslations("nav");

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
    >
      <ul className="pointer-events-auto flex items-center gap-1 rounded-full border border-line/80 bg-surface/80 p-1.5 shadow-[0_8px_28px_-10px_rgba(59,47,42,0.35)] backdrop-blur-xl supports-[backdrop-filter]:bg-surface/70 dark:shadow-[0_8px_28px_-10px_rgba(0,0,0,0.7)]">
        {TABS.map(({ key, href, Icon }) => {
          const active = activeTab === key;
          return (
            <li key={key} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  active ? "text-brand" : "text-ink-muted hover:text-ink"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="tab-bar-active-pill"
                    className="absolute inset-0 rounded-full bg-brand-soft"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                    aria-hidden="true"
                  />
                )}
                <span className="relative">
                  <Icon aria-hidden className="size-5" strokeWidth={2} />
                </span>
                <span className="relative leading-none">{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
