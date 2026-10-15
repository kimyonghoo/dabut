import { createClient } from "@/lib/supabase/server";
import { TransactionForm } from "@/components/ledger/transaction-form";

export default async function NewTransactionPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase.from("categories").select("*");

  return <TransactionForm mode="create" categories={categories ?? []} />;
}
