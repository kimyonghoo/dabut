import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TransactionForm } from "@/components/ledger/transaction-form";

export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: transaction } = await supabase.from("transactions").select("*").eq("id", id).single();
  if (!transaction) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: categories }, { data: paymentMethods }] = await Promise.all([
    supabase.from("categories").select("*"),
    // Deliberately the one place that fetches *other members'* payment
    // methods too — RLS now allows a connection member to SELECT a payment
    // method they don't own (see 0019_payment_methods_shared_visibility.sql)
    // so the chip picker can offer a shared/joint card the partner
    // registered. Only id/name/icon/owner_id are selected — never
    // monthly_goal, which stays private to whoever registered the method.
    supabase.from("payment_methods").select("id, name, icon, owner_id").order("created_at", { ascending: true }),
  ]);

  return (
    <TransactionForm
      mode="edit"
      transaction={transaction}
      categories={categories ?? []}
      paymentMethods={paymentMethods ?? []}
      currentUserId={user?.id ?? null}
    />
  );
}
