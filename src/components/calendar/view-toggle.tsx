"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

export function ViewToggle() {
  const t = useTranslations("calendar");
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const view = searchParams.get("view") ?? "month";

  return (
    <nav>
      <button
        type="button"
        className={view === "month" ? "bg-brand" : undefined}
        onClick={() => router.push({ pathname, query: { view: "month" } })}
      >
        {t("monthView")}
      </button>
      <button
        type="button"
        className={view === "thread" ? "bg-brand" : undefined}
        onClick={() => router.push({ pathname, query: { view: "thread" } })}
      >
        {t("threadView")}
      </button>
    </nav>
  );
}
