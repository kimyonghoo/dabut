export function isValidWebhookSecret(headerValue: string | null): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  // An unset/empty secret must never authorize anything.
  return !!secret && headerValue !== null && headerValue === secret;
}
