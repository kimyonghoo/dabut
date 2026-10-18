import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Display name of the user's single linked partner, for labels like
 * "OO의 일정". Returns null when there is no partner or more than one
 * (callers then fall back to a generic "partner" label).
 */
export async function resolvePartnerName(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string | null> {
  const { data: memberships } = await supabase
    .from("connection_members")
    .select("connection_id")
    .eq("user_id", userId);
  const connectionIds = (memberships ?? []).map((m) => m.connection_id);
  if (connectionIds.length === 0) return null;

  const { data: others } = await supabase
    .from("connection_members")
    .select("user_id, profiles(display_name)")
    .in("connection_id", connectionIds)
    .neq("user_id", userId);

  const names = new Map<string, string>();
  for (const row of others ?? []) {
    const profile = (row as unknown as { profiles: { display_name: string | null } | null }).profiles;
    names.set(row.user_id, profile?.display_name?.trim() ?? "");
  }
  if (names.size !== 1) return null;
  const [name] = names.values();
  return name || null;
}
