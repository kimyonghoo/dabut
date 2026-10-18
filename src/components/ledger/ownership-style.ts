import type { TransactionOwnership } from "@/lib/ledger/categorize-transaction";

/** Solid dot color, mirroring the calendar's category-style tokens. */
export const DOT_CLASSNAME: Record<TransactionOwnership, string> = {
  mine: "bg-brand",
  partner: "bg-partner",
};

/** Left accent bar color for ledger rows. */
export const BORDER_CLASSNAME: Record<TransactionOwnership, string> = {
  mine: "border-l-brand",
  partner: "border-l-partner",
};
