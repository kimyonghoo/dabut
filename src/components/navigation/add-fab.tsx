"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname } from "@/i18n/navigation";

/** 달력/가계부 탭에서만 보이는 우하단 + 플로팅 버튼 (엄지가 닿는 위치). */
export function AddFab() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tCal = useTranslations("calendar");
  const tLedger = useTranslations("ledger");

  const isCalendar = pathname === "/calendar";
  const isLedger = pathname === "/ledger";
  if (!isCalendar && !isLedger) return null;

  const href = isCalendar
    ? { pathname: "/calendar/new" as const, query: searchParams.get("view") === "thread" ? { returnView: "thread" } : undefined }
    : { pathname: "/ledger/new" as const };
  const label = isCalendar ? tCal("addEvent") : tLedger("addTransaction");

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md px-4 pb-[calc(env(safe-area-inset-bottom)+5.75rem)]">
      <div className="flex justify-end">
        <Link
          href={href}
          aria-label={label}
          title={label}
          className="pointer-events-auto grid size-14 place-items-center rounded-full bg-brand text-white shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition hover:bg-brand-strong active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <Plus aria-hidden className="size-7" strokeWidth={2.5} />
        </Link>
      </div>
    </div>
  );
}
