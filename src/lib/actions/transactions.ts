"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateAmount } from "@/lib/ledger/validate-amount";
import { transactionNotificationMessage, type NotificationAction } from "@/lib/telegram/messages";
import { notifyConnectionMembers } from "@/lib/telegram/notify-connection";
import { resolveActorName } from "@/lib/telegram/actor-name";

export type TransactionActionState = { error?: string };

async function resolveConnectionId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("connection_members")
    .select("connection_id")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })
    .limit(1);
  // No connection yet → personal (solo) ledger entry.
  if (!data || data.length === 0) return null;
  return data[0].connection_id;
}

type ReturnedTransaction = {
  connection_id: string | null;
  type: string;
  amount: number;
  categories: { name: string } | null;
};

const RETURNING = "connection_id, type, amount, categories(name)";

async function redirectToLedger(toast: "transactionCreated" | "transactionUpdated" | "transactionDeleted"): Promise<never> {
  return redirect({ href: { pathname: "/ledger", query: { toast } }, locale: await getLocale() });
}

async function notifyTransaction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email?: string | null },
  action: NotificationAction,
  row: ReturnedTransaction | null
) {
  if (!row || !row.connection_id) return;
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
  // redirect throws (NEXT_REDIRECT) — must stay last and outside any try/catch.
  return redirectToLedger("transactionCreated");
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
  // redirect throws (NEXT_REDIRECT) — must stay last and outside any try/catch.
  return redirectToLedger("transactionUpdated");
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
  // redirect throws (NEXT_REDIRECT) — must stay last and outside any try/catch.
  return redirectToLedger("transactionDeleted");
}
