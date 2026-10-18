import { createServiceClient } from "@/lib/supabase/service";
import { isValidWebhookSecret } from "@/lib/telegram/webhook-auth";
import { parseStartCommand } from "@/lib/telegram/parse-start-command";
import { sendTelegramMessage } from "@/lib/telegram/send-message";
import { handleSignupStart } from "@/lib/telegram/handle-signup-start";

const SIGNUP_START_PREFIX = "signup_";

type TelegramUpdate = { message?: { text?: string; chat?: { id?: number } } };

export async function POST(request: Request) {
  // Auth boundary: reject before any body parsing or database access.
  if (!isValidWebhookSecret(request.headers.get("X-Telegram-Bot-Api-Secret-Token"))) {
    return new Response("unauthorized", { status: 401 });
  }

  // From here on, always answer 200: a non-200 makes Telegram retry the same
  // update endlessly.
  try {
    const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
    const text = update?.message?.text;
    const chatId = update?.message?.chat?.id;
    if (!text || chatId === undefined) return new Response("ok", { status: 200 });

    const isStart = /^\/start(\s|$)/.test(text.trim());
    if (!isStart) return new Response("ok", { status: 200 });

    const code = parseStartCommand(text);
    if (!code) {
      await sendTelegramMessage(String(chatId), "다붓 설정 화면의 '연결하기' 버튼으로 시작해 주세요");
      return new Response("ok", { status: 200 });
    }

    const supabase = createServiceClient();

    // Signup verification deep link (?start=signup_<token>), distinct from
    // the partner-link flow below — handled separately so one never leaks
    // into the other's lookup.
    if (code.startsWith(SIGNUP_START_PREFIX)) {
      await handleSignupStart(supabase, code.slice(SIGNUP_START_PREFIX.length), String(chatId));
      return new Response("ok", { status: 200 });
    }

    const { data: linkRow } = await supabase
      .from("telegram_link_codes")
      .select("user_id")
      .eq("code", code)
      .maybeSingle();

    if (linkRow) {
      const { error: linkError } = await supabase
        .from("profiles")
        .update({ telegram_chat_id: String(chatId) })
        .eq("id", linkRow.user_id);
      if (linkError) {
        console.error("telegram webhook: linking failed:", linkError.message);
        return new Response("ok", { status: 200 });
      }
      await supabase.from("telegram_link_codes").delete().eq("user_id", linkRow.user_id);
      await sendTelegramMessage(String(chatId), "다붓 계정과 연결됐어요!");
    } else {
      await sendTelegramMessage(String(chatId), "연결 코드를 찾을 수 없어요");
    }
  } catch (err) {
    console.error("telegram webhook error:", err);
  }

  return new Response("ok", { status: 200 });
}
