import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * The couple's shared "이번 달 목표 지출액" (see 0026_connection_monthly_goal.sql)
 * — null when there's no connection or no goal has been set yet.
 */
export async function resolveMonthlySpendingGoal(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<number | null> {
  const { data: memberships } = await supabase
    .from("connection_members")
    .select("connection_id")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })
    .limit(1);
  const connectionId = memberships?.[0]?.connection_id;
  if (!connectionId) return null;

  const { data: connection } = await supabase
    .from("connections")
    .select("monthly_spending_goal")
    .eq("id", connectionId)
    .maybeSingle();
  return connection?.monthly_spending_goal == null ? null : Number(connection.monthly_spending_goal);
}
