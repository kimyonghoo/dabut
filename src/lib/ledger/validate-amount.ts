export function validateAmount(raw: string): { amount: number } | { error: string } {
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Amount must be greater than 0" };
  }
  return { amount };
}
