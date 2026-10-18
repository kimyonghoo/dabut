"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { eventNotificationMessage, transactionNotificationMessage } from "@/lib/telegram/messages";
import { notifyConnectionMembers } from "@/lib/telegram/notify-connection";
import { resolveActorName } from "@/lib/telegram/actor-name";

/**
 * Non-redirecting deletes for the swipe-to-delete list rows. Same semantics
 * as deleteEvent / deleteTransaction (RLS: owner-only delete; the linked
 * partner is notified on Telegram and sees it live via Realtime), but they
 * return a result so the list can roll back its optimistic removal.
 */
export type QuickDeleteResult = { ok: true } | { ok: false; error: "notAuthenticated" | "notFound" | "failed" };

export async function quickDeleteEvent(eventId: string): Promise<QuickDeleteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "notAuthenticated" };

  const { data: deleted, error } = await supabase
    .from("events")
    .delete()
    .eq("id", eventId)
    .select("title, connection_id, start_at, all_day")
    .maybeSingle();
  if (error) {
    console.error("quickDeleteEvent failed:", error.message);
    return { ok: false, error: "failed" };
  }
  // RLS matches 0 rows when the caller isn't the owner (or it's already gone).
  if (!deleted) return { ok: false, error: "notFound" };

  await notifyConnectionMembers(supabase, {
    connectionId: deleted.connection_id,
    excludeUserId: user.id,
    message: eventNotificationMessage({
      action: "deleted",
      actorName: await resolveActorName(supabase, user),
      title: deleted.title,
      startAt: deleted.start_at,
      allDay: deleted.all_day,
    }),
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

type DeletedTransaction = {
  connection_id: string | null;
  type: string;
  amount: number;
  categories: { name: string } | null;
};

export async function quickDeleteTransaction(transactionId: string): Promise<QuickDeleteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "notAuthenticated" };

  const { data, error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId)
    .select("connection_id, type, amount, categories(name)")
    .maybeSingle();
  if (error) {
    console.error("quickDeleteTransaction failed:", error.message);
    return { ok: false, error: "failed" };
  }
  const row = data as unknown as DeletedTransaction | null;
  if (!row) return { ok: false, error: "notFound" };

  if (row.connection_id) {
    await notifyConnectionMembers(supabase, {
      connectionId: row.connection_id,
      excludeUserId: user.id,
      message: transactionNotificationMessage({
        action: "deleted",
        actorName: await resolveActorName(supabase, user),
        type: row.type as "expense" | "income",
        amount: Number(row.amount),
        categoryName: row.categories?.name ?? "",
      }),
    });
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
