"use server";

import { createClient } from "@/lib/supabase/server";

export type VerifyPasswordResult = { ok: true } | { ok: false; error: "notAuthenticated" | "invalid" | "failed" };

/**
 * Re-confirms the signed-in user's password before letting them into a
 * sensitive area (Settings) — a lightweight "are you still you" check, not a
 * full re-login. Supabase has no standalone "verify this password" call, so
 * the standard technique is to attempt signInWithPassword with the user's
 * own email again: success means the password was correct (and harmlessly
 * re-issues the same session), failure means it wasn't.
 */
export async function verifyCurrentPassword(password: string): Promise<VerifyPasswordResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "notAuthenticated" };

  const { error } = await supabase.auth.signInWithPassword({ email: user.email, password });
  if (error) {
    // Any sign-in failure here means "wrong password" from the user's point
    // of view — never surface Supabase's own wording (rate-limit/network
    // errors read the same as a wrong password to the person re-entering it).
    return { ok: false, error: "invalid" };
  }
  return { ok: true };
}
