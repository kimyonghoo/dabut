"use server";

import { createClient } from "@/lib/supabase/server";

export type SearchState = { results?: Array<{ id: string; display_name: string }>; error?: string };

export async function searchProfileByEmail(_prevState: SearchState, formData: FormData): Promise<SearchState> {
  const email = formData.get("email") as string;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_profile_by_email", { target_email: email });
  if (error) return { error: error.message };
  return { results: data ?? [] };
}

// Postgres error code for a unique-constraint violation — used as a backstop
// in case of a race between the pre-checks below and the insert (e.g. a
// double-click firing two requests at once).
const UNIQUE_VIOLATION = "23505";

export async function sendConnectionInvitation(inviteeId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Pre-check for an existing pending invitation between these two users in
  // either direction, so a resend (double-click, or trying again while the
  // first invite is still unanswered) gets a clear, localized message
  // instead of hitting connection_invitations_pending_pair_idx's unique
  // violation and surfacing the raw Postgres error.
  const { data: samePending } = await supabase
    .from("connection_invitations")
    .select("id")
    .eq("inviter_id", user.id)
    .eq("invitee_id", inviteeId)
    .eq("status", "pending")
    .maybeSingle();
  if (samePending) return { error: "duplicateInvite" };

  const { data: reversePending } = await supabase
    .from("connection_invitations")
    .select("id")
    .eq("inviter_id", inviteeId)
    .eq("invitee_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (reversePending) return { error: "pendingFromTarget" };

  const { error } = await supabase
    .from("connection_invitations")
    .insert({ inviter_id: user.id, invitee_id: inviteeId });
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { error: "duplicateInvite" };
    if (error.message.includes("row-level security")) return { error: "alreadyConnected" };
    return { error: error.message };
  }
  return {};
}

export async function acceptConnectionInvitation(invitationId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_connection_invitation", {
    target_invitation_id: invitationId,
  });
  if (error) return { error: error.message };
  return {};
}

export async function declineConnectionInvitation(invitationId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("connection_invitations")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("id", invitationId)
    .eq("invitee_id", user.id)
    .eq("status", "pending");
  if (error) return { error: error.message };
  return {};
}

export async function cancelConnectionInvitation(invitationId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("connection_invitations")
    .update({ status: "cancelled", responded_at: new Date().toISOString() })
    .eq("id", invitationId)
    .eq("inviter_id", user.id)
    .eq("status", "pending");
  if (error) return { error: error.message };
  return {};
}
