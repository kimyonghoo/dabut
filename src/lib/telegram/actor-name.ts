import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// Display name used in notification text: profiles.display_name, falling back
// to the email's local part when it's empty.
export async function resolveActorName(
  supabase: SupabaseClient<Database>,
  user: { id: string; email?: string | null }
): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", user.id)
    .maybeSingle();
  const displayName = data?.display_name?.trim();
  if (displayName) return displayName;
  const email = data?.email ?? user.email ?? "";
  return email.split("@")[0] || "상대방";
}
