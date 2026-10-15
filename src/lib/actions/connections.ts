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

export async function sendConnectionInvitation(inviteeId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("connection_invitations")
    .insert({ inviter_id: user.id, invitee_id: inviteeId });
  if (error) return { error: error.message };
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
