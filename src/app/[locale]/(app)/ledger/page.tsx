import { format, startOfMonth, endOfMonth } from "date-fns";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { PageHeader } from "@/components/ui/page-header";
import { buttonClass } from "@/components/ui/button";
import { LedgerView, type LedgerRow } from "@/components/ledger/ledger-view";
import { hasConnection, resolvePartnerName } from "@/lib/calendar/partner-name";
import { toDateKey } from "@/lib/dates/relative-day";

export default async function LedgerPage() {
  const t = await getTranslations("ledger");
  const locale = await getLocale();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const [{ data: transactions }, { data: categories }, partnerName, hasPartner] = await Promise.all([
    supabase
      .from("transactions")
      .select("*, categories(name, icon)")
      .gte("occurred_at", monthStart)
      .lte("occurred_at", monthEnd)
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("categories").select("id, name, icon, type"),
    user ? resolvePartnerName(supabase, user.id) : Promise.resolve(null),
    user ? hasConnection(supabase, user.id) : Promise.resolve(false),
  ]);

  const rows: LedgerRow[] = (transactions ?? []).map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    type: row.type as "expense" | "income",
    amount: Number(row.amount),
    memo: row.memo,
    occurredAt: row.occurred_at,
    categoryId: row.category_id,
    category: (row as unknown as { categories: { name: string; icon: string | null } | null }).categories,
  }));

  const monthTitle = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(now);

  return (
    <main className="pb-24">
      <RealtimeRefresh table="transactions" />
      <PageHeader
        title={monthTitle}
        action={
          <Link href="/ledger/new" className={buttonClass("primary")}>
            {t("newTransaction")}
          </Link>
        }
      />
      <LedgerView
        rows={rows}
        categories={categories ?? []}
        currentUserId={user?.id ?? ""}
        serverTodayKey={toDateKey(now)}
        hasPartner={hasPartner}
        partnerName={partnerName}
      />
    </main>
  );
}
