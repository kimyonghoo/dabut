"use server";

import { createClient } from "@/lib/supabase/server";

export type TelegramLinkState = { url?: string; error?: string };

export async function generateTelegramLinkCode(): Promise<TelegramLinkState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const code = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const { error } = await supabase
    .from("telegram_link_codes")
    .upsert({ user_id: user.id, code });
  if (error) return { error: error.message };

  return { url: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${code}` };
}

export async function unlinkTelegram(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ telegram_chat_id: null })
    .eq("id", user.id);
  if (error) return { error: error.message };

  await supabase.from("telegram_link_codes").delete().eq("user_id", user.id);
  return {};
}
