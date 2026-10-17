import assert from "node:assert/strict";

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
assert(token && secret, "TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET must be set");

const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: "https://dabut.vercel.app/api/telegram/webhook",
    secret_token: secret,
  }),
});

const result = await response.json();
console.log(result);
assert(result.ok, "setWebhook failed — see the response above");
console.log("Webhook registered.");
