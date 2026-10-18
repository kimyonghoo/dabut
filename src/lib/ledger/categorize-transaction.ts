export type TransactionOwnership = "mine" | "partner";

/**
 * Unlike events, transactions have no "shared" visibility — every entry
 * belongs to exactly one person's ledger (connection_id just says whether
 * it lives inside a shared couple ledger, not who it belongs to).
 */
export function categorizeTransaction(
  row: { ownerId: string },
  currentUserId: string
): TransactionOwnership {
  return row.ownerId === currentUserId ? "mine" : "partner";
}
