"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateAmount } from "@/lib/ledger/validate-amount";
import { crossedMilestoneThresholds } from "@/lib/ledger/payment-method-milestones";
import {
  transactionNotificationMessage,
  paymentMethodMilestoneMessage,
  type NotificationAction,
} from "@/lib/telegram/messages";
import { notifyConnectionMembers } from "@/lib/telegram/notify-connection";
import { sendTelegramMessage } from "@/lib/telegram/send-message";
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
  id: string;
  connection_id: string | null;
  type: string;
  amount: number;
  memo: string | null;
  occurred_at: string;
  payment_method_id: string | null;
  categories: { name: string; icon: string | null } | null;
  payment_methods: { name: string } | null;
};

const RETURNING =
  "id, connection_id, type, amount, memo, occurred_at, payment_method_id, categories(name, icon), payment_methods(name)";

/**
 * Validates that a `paymentMethodId` form value (optional field — "no
 * selection" is valid) refers to a payment method visible to the caller:
 * either their own, or one registered by a connected partner and shared via
 * the relaxed SELECT policy (see 0019_payment_methods_shared_visibility.sql
 * — the whole point of that migration is to let a user tag their own
 * transaction with a joint/shared card the partner registered). This
 * intentionally relies on RLS to decide *visibility* here — unlike the
 * owner_id filters elsewhere in this file/app that exist specifically to
 * keep a payment method's private goal data from being fetched for anyone
 * but its owner, this check only confirms "can the caller see this id at
 * all," which is exactly what the SELECT policy already encodes.
 */
async function resolvePaymentMethodId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  raw: FormDataEntryValue | null
): Promise<{ paymentMethodId: string | null } | { error: string }> {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return { paymentMethodId: null };

  const { data } = await supabase.from("payment_methods").select("id").eq("id", value).maybeSingle();
  if (!data) return { error: "Invalid payment method" };
  return { paymentMethodId: value };
}

/**
 * After a transaction is created/updated with a payment method tag, checks
 * whether it just pushed that payment method's *current calendar month*
 * cumulative spend across one or more of the 50/80/100% monthly-goal
 * thresholds for the first time this month, and if so sends exactly one
 * achievement-framed Telegram message per newly-crossed threshold — to the
 * payment method's owner only (the goal is private; a connected partner
 * never sees it, even for a shared transaction).
 *
 * "Current calendar month" matches what the ledger hero's 카드실적 sheet
 * displays (today's month, using the server clock — the same simple,
 * non-per-user-timezone boundary the ledger page itself already uses for
 * its monthly totals), not the month the edited transaction happens to be
 * dated in. A transaction dated outside the current month doesn't affect
 * this month's tally, so it's skipped entirely.
 *
 * Double-notification is prevented at the database layer: each threshold is
 * recorded in payment_method_milestone_log, whose primary key
 * (payment_method_id, year_month, threshold) makes a second insert for the
 * same threshold in the same month fail with a unique violation — so a race
 * between two near-simultaneous transactions crossing the same threshold
 * can only ever send one message. Deleting a transaction never un-marks a
 * threshold already logged this month: once fired, it stays fired for the
 * rest of the month even if later deletes drop the total back down (the
 * simplest option, and consistent with "achievement", not "budget cap" —
 * un-firing on delete would mean a user could get re-congratulated for the
 * same progress by deleting and re-adding).
 */
async function checkPaymentMethodMilestones(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    ownerId: string;
    transactionId: string;
    paymentMethodId: string | null;
    amount: number;
    occurredAt: string;
  }
): Promise<void> {
  const { ownerId, transactionId, paymentMethodId, amount, occurredAt } = params;
  if (!paymentMethodId) return;

  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
  if (occurredAt < monthStart || occurredAt > monthEnd) return;

  // Owner-scoped on purpose (defense-in-depth, not just RLS): `ownerId`
  // here is the transaction's creator. Since 0019_payment_methods_shared_
  // visibility.sql, that creator may now be a connected partner tagging a
  // *shared* payment method they don't own — in that case this lookup
  // intentionally finds nothing and the function returns early without
  // notifying anyone. Goal-crossing notifications stay tied to the actual
  // registrant acting on their own transactions; a partner's spending on a
  // shared card doesn't (today) trigger the registrant's milestone alerts.
  // Extending that would mean inserting into payment_method_milestone_log
  // on behalf of a different auth.uid(), which that table's still-owner-
  // only RLS policies correctly block — fixing that is a larger, separate
  // feature.
  const { data: method } = await supabase
    .from("payment_methods")
    .select("name, monthly_goal")
    .eq("id", paymentMethodId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  const goal = method?.monthly_goal != null ? Number(method.monthly_goal) : 0;
  if (!method || goal <= 0) return;

  // Sum every other transaction tagged to this payment method this month —
  // excluding this row by id, so an edit to an already-tagged transaction
  // doesn't double-count its own prior contribution.
  const { data: others } = await supabase
    .from("transactions")
    .select("amount")
    .eq("payment_method_id", paymentMethodId)
    .gte("occurred_at", monthStart)
    .lte("occurred_at", monthEnd)
    .neq("id", transactionId);
  const previousTotal = (others ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  const newTotal = previousTotal + amount;

  const crossed = crossedMilestoneThresholds(previousTotal, newTotal, goal);
  if (crossed.length === 0) return;

  const yearMonth = format(now, "yyyy-MM");
  let chatId: string | null | undefined;

  for (const threshold of crossed) {
    const { error: insertError } = await supabase
      .from("payment_method_milestone_log")
      .insert({ payment_method_id: paymentMethodId, year_month: yearMonth, threshold });
    if (insertError) {
      // 23505 = someone (possibly a concurrent request) already logged this
      // threshold for this payment method this month — already notified,
      // skip silently. Anything else is unexpected but must not fail the
      // transaction that triggered this check.
      if (insertError.code !== "23505") {
        console.error("checkPaymentMethodMilestones: milestone log insert failed:", insertError.message);
      }
      continue;
    }

    if (chatId === undefined) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("telegram_chat_id")
        .eq("id", ownerId)
        .maybeSingle();
      chatId = profile?.telegram_chat_id ?? null;
    }
    if (chatId) {
      await sendTelegramMessage(
        chatId,
        paymentMethodMilestoneMessage({ threshold, cardName: method.name, spent: newTotal, goal })
      );
    }
  }
}

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
      categoryIcon: row.categories?.icon ?? null,
      paymentMethodName: row.payment_methods?.name ?? null,
      memo: row.memo,
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

  const paymentMethodResult = await resolvePaymentMethodId(supabase, formData.get("paymentMethodId"));
  if ("error" in paymentMethodResult) return paymentMethodResult;

  const { data, error } = await supabase.from("transactions").insert({
    connection_id: connectionId,
    owner_id: user.id,
    created_by: user.id,
    category_id: formData.get("categoryId") as string,
    type: formData.get("type") as "expense" | "income",
    amount: amountResult.amount,
    memo: (formData.get("memo") as string) || null,
    occurred_at: formData.get("occurredAt") as string,
    payment_method_id: paymentMethodResult.paymentMethodId,
  })
    .select(RETURNING)
    .maybeSingle();
  if (error) return { error: error.message };

  const row = data as unknown as ReturnedTransaction | null;
  await notifyTransaction(supabase, user, "created", row);
  if (row) {
    await checkPaymentMethodMilestones(supabase, {
      ownerId: user.id,
      transactionId: row.id,
      paymentMethodId: row.payment_method_id,
      amount: Number(row.amount),
      occurredAt: row.occurred_at,
    });
  }

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

  const paymentMethodResult = await resolvePaymentMethodId(supabase, formData.get("paymentMethodId"));
  if ("error" in paymentMethodResult) return paymentMethodResult;

  const { data, error } = await supabase
    .from("transactions")
    .update({
      category_id: formData.get("categoryId") as string,
      type: formData.get("type") as "expense" | "income",
      amount: amountResult.amount,
      memo: (formData.get("memo") as string) || null,
      occurred_at: formData.get("occurredAt") as string,
      payment_method_id: paymentMethodResult.paymentMethodId,
    })
    .eq("id", transactionId)
    .select(RETURNING)
    .maybeSingle();
  if (error) return { error: error.message };

  const row = data as unknown as ReturnedTransaction | null;
  await notifyTransaction(supabase, user, "updated", row);
  if (row) {
    await checkPaymentMethodMilestones(supabase, {
      ownerId: user.id,
      transactionId: row.id,
      paymentMethodId: row.payment_method_id,
      amount: Number(row.amount),
      occurredAt: row.occurred_at,
    });
  }

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
