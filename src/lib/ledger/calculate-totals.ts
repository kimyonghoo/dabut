export function calculateMonthlyTotals(
  transactions: Array<{ type: "expense" | "income"; amount: number }>
): { income: number; expense: number; net: number } {
  let income = 0;
  let expense = 0;

  for (const transaction of transactions) {
    if (transaction.type === "income") {
      income += transaction.amount;
    } else {
      expense += transaction.amount;
    }
  }

  return { income, expense, net: income - expense };
}
