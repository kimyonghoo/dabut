"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { nicknameViolations, normalizeNickname, type NicknameRule } from "@/lib/auth/nickname-policy";

export type UpdateDisplayNameResult =
  | { ok: true; displayName: string }
  | { ok: false; error: NicknameRule | "taken" | "notAuthenticated" | "failed" };

// Postgres error code for a unique-constraint violation — backstop for a
// race between the uniqueness pre-check below and the update itself (e.g.
// two people saving the same nickname at the same moment).
const UNIQUE_VIOLATION = "23505";

/**
 * Updates the signed-in user's `profiles.display_name`. The user comes from
 * the session (never from client input). Validated with the same pure
 * nickname-policy rules as signup, and checked for case-insensitive
 * uniqueness excluding the caller's own row.
 */
export async function updateDisplayName(name: string): Promise<UpdateDisplayNameResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "notAuthenticated" };

  const nickname = normalizeNickname(String(name ?? ""));
  const violations = nicknameViolations(nickname);
  if (violations.length > 0) return { ok: false, error: violations[0] };

  const admin = createServiceClient();

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .ilike("display_name", nickname)
    .neq("id", user.id)
    .maybeSingle();
  if (existing) return { ok: false, error: "taken" };

  const { error } = await admin.from("profiles").update({ display_name: nickname }).eq("id", user.id);
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { ok: false, error: "taken" };
    console.error("updateDisplayName: update failed:", error.message);
    return { ok: false, error: "failed" };
  }

  return { ok: true, displayName: nickname };
}
