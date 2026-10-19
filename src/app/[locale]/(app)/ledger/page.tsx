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

  const [
    { data: transactions },
    { data: categories },
    { data: paymentMethodGoalRows },
    { data: paymentMethodOptionRows },
    partnerName,
    hasPartner,
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("*, categories(name, icon)")
      .gte("occurred_at", monthStart)
      .lte("occurred_at", monthEnd)
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("categories").select("id, name, icon, type"),
    // Only the signed-in user's own payment methods that have a goal set.
    // RLS now also lets a connected partner SELECT this table (see
    // 0019_payment_methods_shared_visibility.sql, for the chip picker use
    // case), so an explicit owner_id filter is required here as
    // defense-in-depth — goals/milestones stay personal and are never
    // shown for someone else's payment method, regardless of what RLS
    // alone would allow through. `user?.id ?? ""` never matches a real
    // row, so an unauthenticated request (shouldn't normally reach this
    // page) safely yields no rows rather than throwing.
    supabase
      .from("payment_methods")
      .select("id, name, icon, monthly_goal")
      .eq("owner_id", user?.id ?? "")
      .not("monthly_goal", "is", null)
      .order("created_at", { ascending: true }),
    // Deliberately the *shared* list — the viewer's own payment methods plus
    // a connected partner's (RLS-visible per 0019) — for the ledger's
    // payment-method filter chips. Only id/name/icon: never monthly_goal.
    supabase.from("payment_methods").select("id, name, icon").order("created_at", { ascending: true }),
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
    paymentMethodId: row.payment_method_id,
    category: (row as unknown as { categories: { name: string; icon: string | null } | null }).categories,
  }));

  const paymentMethodGoals = (paymentMethodGoalRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    icon: row.icon,
    monthlyGoal: Number(row.monthly_goal),
  }));

  const paymentMethods = (paymentMethodOptionRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    icon: row.icon,
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
        paymentMethodGoals={paymentMethodGoals}
        paymentMethods={paymentMethods}
      />
    </main>
  );
}
