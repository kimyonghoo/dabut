import type { createServiceClient } from "@/lib/supabase/service";
import {
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  futureIso,
  generateOtp,
  hashOtp,
  isExpired,
} from "@/lib/auth/signup-otp";
import { sendTelegramMessage } from "./send-message";

/**
 * Handles `/start signup_<token>` from the Telegram webhook: generates and
 * sends a fresh 6-digit OTP for a pending signup verification row.
 *
 * If the same deep link is tapped again before the previous OTP was used,
 * this regenerates and resends rather than erroring — except when tapped
 * again within OTP_RESEND_COOLDOWN_MS, which just asks the user to wait, to
 * avoid hammering Telegram's rate limits.
 */
export async function handleSignupStart(
  supabase: ReturnType<typeof createServiceClient>,
  token: string,
  chatId: string
): Promise<void> {
  const { data: row } = await supabase
    .from("signup_verifications")
    .select("link_expires_at, last_sent_at")
    .eq("token", token)
    .maybeSingle();

  if (!row) {
    await sendTelegramMessage(chatId, "인증 링크를 찾을 수 없어요. 다붓 가입 화면에서 다시 시도해 주세요");
    return;
  }

  if (isExpired(row.link_expires_at)) {
    await sendTelegramMessage(chatId, "인증 링크가 만료됐어요. 다붓 가입 화면에서 다시 시도해 주세요");
    return;
  }

  if (row.last_sent_at && Date.now() - new Date(row.last_sent_at).getTime() < OTP_RESEND_COOLDOWN_MS) {
    await sendTelegramMessage(chatId, "잠시 후 다시 시도해 주세요");
    return;
  }

  const otp = generateOtp();
  const { error } = await supabase
    .from("signup_verifications")
    .update({
      otp_hash: hashOtp(token, otp),
      telegram_chat_id: chatId,
      attempts: 0,
      otp_expires_at: futureIso(OTP_TTL_MS),
      last_sent_at: new Date().toISOString(),
    })
    .eq("token", token);

  if (error) {
    console.error("handleSignupStart: failed to store OTP:", error.message);
    return;
  }

  await sendTelegramMessage(chatId, `다붓 인증번호는 ${otp} 이에요. 10분 안에 입력해 주세요`);
}
