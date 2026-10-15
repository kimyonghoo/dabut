import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TransactionForm } from "@/components/ledger/transaction-form";

export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: transaction } = await supabase.from("transactions").select("*").eq("id", id).single();
  if (!transaction) notFound();

  const { data: categories } = await supabase.from("categories").select("*");

  return <TransactionForm mode="edit" transaction={transaction} categories={categories ?? []} />;
}
