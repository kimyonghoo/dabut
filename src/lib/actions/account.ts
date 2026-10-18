"use server";

import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type DeleteAccountResult = { ok: true } | { ok: false; error: string };

/**
 * Permanently deletes the signed-in user's account.
 * The user is taken from the session (never from client input). The
 * service-role client is used only on the server:
 *   1. prepare_account_deletion() removes the user's own items, turns the
 *      linked partner's items into personal ones and unlinks the partner
 *      (see supabase/migrations/0013_account_deletion.sql);
 *   2. the auth user is deleted, cascading to profile, categories,
 *      memberships, invitations and telegram link codes.
 * The client then signs out and navigates to /login.
 */
export async function deleteAccount(confirmation: string): Promise<DeleteAccountResult> {
  const t = await getTranslations("account");
  if (typeof confirmation !== "string" || confirmation.trim() !== t("confirmWord")) {
    return { ok: false, error: "confirmationMismatch" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "notAuthenticated" };

  const admin = createServiceClient();

  const { error: prepareError } = await admin.rpc("prepare_account_deletion", { target_user_id: user.id });
  if (prepareError) {
    console.error("deleteAccount: prepare failed:", prepareError.message);
    return { ok: false, error: "failed" };
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("deleteAccount: auth delete failed:", deleteError.message);
    return { ok: false, error: "failed" };
  }

  // Clear the session cookies on this response too.
  await supabase.auth.signOut().catch(() => undefined);
  return { ok: true };
}
