"use server";

import { createClient } from "@/lib/supabase/server";

export type ToggleDailyDigestResult = { ok: true } | { ok: false; error: "notAuthenticated" | "failed" };

/**
 * Flips `profiles.daily_digest_enabled` for the signed-in user. A Server
 * Action rather than a fire-and-forget client-side `.update()` call,
 * specifically so a failure (RLS, network, whatever) surfaces instead of
 * silently no-opping — the previous client-side version left the toggle
 * showing "on" in the UI while the DB quietly stayed "off", so a refresh
 * looked like the setting had reset itself.
 */
export async function toggleDailyDigest(enabled: boolean): Promise<ToggleDailyDigestResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "notAuthenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ daily_digest_enabled: enabled })
    .eq("id", user.id);

  if (error) {
    console.error("toggleDailyDigest failed:", error.message);
    return { ok: false, error: "failed" };
  }
  return { ok: true };
}
