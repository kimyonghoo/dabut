"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateAmount } from "@/lib/ledger/validate-amount";

export type TransactionActionState = { error?: string };

async function resolveConnectionId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | { error: string }> {
  const { data } = await supabase
    .from("connection_members")
    .select("connection_id")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })
    .limit(1);
  if (!data || data.length === 0) return { error: "Select a connection first" };
  return data[0].connection_id;
}

export async function createTransaction(
  _prevState: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const connectionId = await resolveConnectionId(supabase, user.id);
  if (typeof connectionId !== "string") return connectionId;

  const amountResult = validateAmount(formData.get("amount") as string);
  if ("error" in amountResult) return amountResult;

  const { error } = await supabase.from("transactions").insert({
    connection_id: connectionId,
    owner_id: user.id,
    created_by: user.id,
    category_id: formData.get("categoryId") as string,
    type: formData.get("type") as "expense" | "income",
    amount: amountResult.amount,
    memo: (formData.get("memo") as string) || null,
    occurred_at: formData.get("occurredAt") as string,
  });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return {};
}

export async function updateTransaction(
  transactionId: string,
  _prevState: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  const supabase = await createClient();

  const amountResult = validateAmount(formData.get("amount") as string);
  if ("error" in amountResult) return amountResult;

  const { error } = await supabase
    .from("transactions")
    .update({
      category_id: formData.get("categoryId") as string,
      type: formData.get("type") as "expense" | "income",
      amount: amountResult.amount,
      memo: (formData.get("memo") as string) || null,
      occurred_at: formData.get("occurredAt") as string,
    })
    .eq("id", transactionId);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return {};
}

export async function deleteTransaction(transactionId: string): Promise<TransactionActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().eq("id", transactionId);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return {};
}
