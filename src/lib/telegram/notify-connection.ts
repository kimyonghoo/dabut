import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { sendTelegramMessage } from "./send-message";

export async function notifyConnectionMembers(
  supabase: SupabaseClient<Database>,
  params: { connectionId: string | null; excludeUserId: string; message: string }
): Promise<void> {
  const { connectionId, excludeUserId, message } = params;
  if (connectionId === null) return;

  try {
    const { data, error } = await supabase
      .from("connection_members")
      .select("user_id, profiles(telegram_chat_id)")
      .eq("connection_id", connectionId)
      .neq("user_id", excludeUserId);
    if (error) {
      console.error("notifyConnectionMembers: member lookup failed:", error.message);
      return;
    }

    const chatIds = (data ?? [])
      .map(
        (row) =>
          (row as unknown as { profiles: { telegram_chat_id: string | null } | null }).profiles
            ?.telegram_chat_id ?? null
      )
      .filter((id): id is string => !!id);

    await Promise.allSettled(chatIds.map((chatId) => sendTelegramMessage(chatId, message)));
  } catch (err) {
    console.error("notifyConnectionMembers error:", err);
  }
}
