import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

/**
 * All visible categories (expense + income, defaults + custom), ordered
 * most-used-first by this signed-in user's own transaction history —
 * CategoryPicker shows only the top 10 by default (the rest behind
 * "더보기"), so the cutoff should reflect what's actually used often, not
 * whatever order Postgres happens to return rows in.
 */
export async function fetchCategoriesSortedByUsage(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<CategoryRow[]> {
  const [{ data: categories }, { data: txCategoryIds }] = await Promise.all([
    supabase.from("categories").select("*"),
    supabase.from("transactions").select("category_id"),
  ]);

  const countById = new Map<string, number>();
  for (const row of txCategoryIds ?? []) {
    countById.set(row.category_id, (countById.get(row.category_id) ?? 0) + 1);
  }

  return [...(categories ?? [])].sort((a, b) => (countById.get(b.id) ?? 0) - (countById.get(a.id) ?? 0));
}
