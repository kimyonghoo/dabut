import { createClient } from "@/lib/supabase/server";
import { TransactionForm } from "@/components/ledger/transaction-form";

export default async function NewTransactionPage() {
  const supabase = await createClient();
  const [{ data: categories }, { data: paymentMethods }] = await Promise.all([
    supabase.from("categories").select("*"),
    // RLS restricts this to the signed-in user's own payment methods —
    // personal, never partner-shared (see 0018_payment_method_goals.sql).
    supabase.from("payment_methods").select("id, name, icon").order("created_at", { ascending: true }),
  ]);

  return <TransactionForm mode="create" categories={categories ?? []} paymentMethods={paymentMethods ?? []} />;
}
