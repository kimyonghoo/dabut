"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function TabBar({ activeTab }: { activeTab: "calendar" | "ledger" }) {
  const t = useTranslations("nav");

  return (
    <nav>
      <Link href="/calendar" className={activeTab === "calendar" ? "bg-brand" : undefined}>
        {t("calendar")}
      </Link>
      <Link href="/ledger" className={activeTab === "ledger" ? "bg-brand" : undefined}>
        {t("ledger")}
      </Link>
    </nav>
  );
}
