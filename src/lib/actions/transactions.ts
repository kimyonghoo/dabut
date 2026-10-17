"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateAmount } from "@/lib/ledger/validate-amount";
import { transactionNotificationMessage, type NotificationAction } from "@/lib/telegram/messages";
import { notifyConnectionMembers } from "@/lib/telegram/notify-connection";
import { resolveActorName } from "@/lib/telegram/actor-name";

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

type ReturnedTransaction = {
  connection_id: string;
  type: string;
  amount: number;
  categories: { name: string } | null;
};

const RETURNING = "connection_id, type, amount, categories(name)";

async function notifyTransaction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email?: string | null },
  action: NotificationAction,
  row: ReturnedTransaction | null
) {
  if (!row) return;
  await notifyConnectionMembers(supabase, {
    connectionId: row.connection_id,
    excludeUserId: user.id,
    message: transactionNotificationMessage({
      action,
      actorName: await resolveActorName(supabase, user),
      type: row.type as "expense" | "income",
      amount: Number(row.amount),
      categoryName: row.categories?.name ?? "",
    }),
  });
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

  const { data, error } = await supabase.from("transactions").insert({
    connection_id: connectionId,
    owner_id: user.id,
    created_by: user.id,
    category_id: formData.get("categoryId") as string,
    type: formData.get("type") as "expense" | "income",
    amount: amountResult.amount,
    memo: (formData.get("memo") as string) || null,
    occurred_at: formData.get("occurredAt") as string,
  })
    .select(RETURNING)
    .maybeSingle();
  if (error) return { error: error.message };

  await notifyTransaction(supabase, user, "created", data as unknown as ReturnedTransaction | null);

  revalidatePath("/", "layout");
  return {};
}

export async function updateTransaction(
  transactionId: string,
  _prevState: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const amountResult = validateAmount(formData.get("amount") as string);
  if ("error" in amountResult) return amountResult;

  const { data, error } = await supabase
    .from("transactions")
    .update({
      category_id: formData.get("categoryId") as string,
      type: formData.get("type") as "expense" | "income",
      amount: amountResult.amount,
      memo: (formData.get("memo") as string) || null,
      occurred_at: formData.get("occurredAt") as string,
    })
    .eq("id", transactionId)
    .select(RETURNING)
    .maybeSingle();
  if (error) return { error: error.message };

  await notifyTransaction(supabase, user, "updated", data as unknown as ReturnedTransaction | null);

  revalidatePath("/", "layout");
  return {};
}

export async function deleteTransaction(transactionId: string): Promise<TransactionActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // DELETE ... RETURNING with the category embed: one round trip for the message.
  const { data, error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId)
    .select(RETURNING)
    .maybeSingle();
  if (error) return { error: error.message };

  await notifyTransaction(supabase, user, "deleted", data as unknown as ReturnedTransaction | null);

  revalidatePath("/", "layout");
  return {};
}
