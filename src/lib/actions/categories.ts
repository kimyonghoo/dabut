"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_ICONS } from "@/components/ledger/category-icon";

export type CreatedCategory = {
  id: string;
  name: string;
  type: "expense" | "income";
  icon: string | null;
};

export type CreateCategoryResult = { category?: CreatedCategory; error?: string };

const MAX_NAME_LENGTH = 12;
const MAX_ICON_LENGTH = 16;

export async function createCategory(input: {
  type: "expense" | "income";
  name: string;
  icon?: string;
}): Promise<CreateCategoryResult> {
  const type = input?.type;
  if (type !== "expense" && type !== "income") return { error: "Invalid category type" };

  const name = (input.name ?? "").trim();
  const nameLength = [...name].length;
  if (nameLength < 1) return { error: "Enter a category name" };
  if (nameLength > MAX_NAME_LENGTH) return { error: `Category name must be ${MAX_NAME_LENGTH} characters or fewer` };

  const icon = (input.icon ?? "").trim();
  if (icon.length > MAX_ICON_LENGTH) return { error: "Invalid icon" };
  const iconKey = Object.prototype.hasOwnProperty.call(CATEGORY_ICONS, icon) ? icon : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Same scoping as transactions: the user's first connection, else personal.
  const { data: memberships } = await supabase
    .from("connection_members")
    .select("connection_id")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true })
    .limit(1);
  const connectionId = memberships?.[0]?.connection_id ?? null;

  const { data, error } = await supabase
    .from("categories")
    .insert({
      type,
      name,
      icon: iconKey,
      connection_id: connectionId,
      owner_id: user.id,
    })
    .select("id, name, type, icon")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "A category with that name already exists" };
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  return {
    category: {
      id: data.id,
      name: data.name,
      type: data.type as "expense" | "income",
      icon: data.icon,
    },
  };
}
