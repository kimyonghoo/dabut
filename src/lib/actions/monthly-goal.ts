"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type MonthlyGoalActionResult = { ok: true } | { ok: false; error: string };

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
  if (!data || data.length === 0) return null;
  return data[0].connection_id;
}

/**
 * "이번 달 목표 지출액" — a single value shared by the whole couple (unlike
 * payment_methods' per-card, owner-only goals), stored on `connections`
 * (0026_connection_monthly_goal.sql) so either member reads/writes the same
 * row. `value` in won; `null` clears the goal. No connection → there is
 * nothing to share a goal on, so this is a no-op error rather than falling
 * back to a personal value.
 */
export async function updateMonthlySpendingGoal(value: number | null): Promise<MonthlyGoalActionResult> {
  if (value !== null && (!Number.isFinite(value) || value < 0)) {
    return { ok: false, error: "invalid" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "notAuthenticated" };

  const connectionId = await resolveConnectionId(supabase, user.id);
  if (!connectionId) return { ok: false, error: "noConnection" };

  const { error } = await supabase
    .from("connections")
    .update({ monthly_spending_goal: value })
    .eq("id", connectionId);

  if (error) {
    console.error("updateMonthlySpendingGoal failed:", error.message);
    return { ok: false, error: "failed" };
  }

  revalidatePath("/settings");
  revalidatePath("/ledger");
  revalidatePath("/ledger/stats");
  return { ok: true };
}
