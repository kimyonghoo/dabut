// Fire-and-forget Telegram sender. Never throws: a failed notification must
// never fail or roll back the CRUD action that triggered it.
export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      }
    );
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`Telegram sendMessage failed (${response.status}): ${body}`);
    }
  } catch (err) {
    console.error("Telegram sendMessage error:", err);
  }
}
