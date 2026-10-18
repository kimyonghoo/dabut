"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PaymentMethod = {
  id: string;
  name: string;
  icon: string | null;
  monthlyGoal: number | null;
};

export type PaymentMethodActionResult = { paymentMethod?: PaymentMethod; error?: string };

const MAX_NAME_LENGTH = 20;
const MAX_ICON_LENGTH = 8; // a couple of codepoints is enough for any single emoji

const SELECT_COLUMNS = "id, name, icon, monthly_goal";

type PaymentMethodRow = { id: string; name: string; icon: string | null; monthly_goal: number | string | null };

function toPaymentMethod(row: PaymentMethodRow): PaymentMethod {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    monthlyGoal: row.monthly_goal == null ? null : Number(row.monthly_goal),
  };
}

function validateName(raw: string): { name: string } | { error: string } {
  const name = (raw ?? "").trim();
  const length = [...name].length;
  if (length < 1) return { error: "nameRequired" };
  if (length > MAX_NAME_LENGTH) return { error: "nameTooLong" };
  return { name };
}

function validateIcon(raw: string | null | undefined): { icon: string | null } | { error: string } {
  const icon = (raw ?? "").trim();
  if (icon.length > MAX_ICON_LENGTH) return { error: "invalidIcon" };
  return { icon: icon || null };
}

function validateGoal(raw: number | null | undefined): { monthlyGoal: number | null } | { error: string } {
  if (raw === null || raw === undefined) return { monthlyGoal: null };
  if (!Number.isFinite(raw) || raw < 0) return { error: "invalidGoal" };
  return { monthlyGoal: raw };
}

export async function createPaymentMethod(input: {
  name: string;
  icon?: string | null;
  monthlyGoal?: number | null;
}): Promise<PaymentMethodActionResult> {
  const nameResult = validateName(input?.name);
  if ("error" in nameResult) return nameResult;
  const iconResult = validateIcon(input?.icon);
  if ("error" in iconResult) return iconResult;
  const goalResult = validateGoal(input?.monthlyGoal);
  if ("error" in goalResult) return goalResult;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "notAuthenticated" };

  const { data, error } = await supabase
    .from("payment_methods")
    .insert({
      owner_id: user.id,
      name: nameResult.name,
      icon: iconResult.icon,
      monthly_goal: goalResult.monthlyGoal,
    })
    .select(SELECT_COLUMNS)
    .single();
  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/ledger");
  return { paymentMethod: toPaymentMethod(data) };
}

export async function updatePaymentMethod(
  id: string,
  input: { name: string; icon?: string | null; monthlyGoal?: number | null }
): Promise<PaymentMethodActionResult> {
  const nameResult = validateName(input?.name);
  if ("error" in nameResult) return nameResult;
  const iconResult = validateIcon(input?.icon);
  if ("error" in iconResult) return iconResult;
  const goalResult = validateGoal(input?.monthlyGoal);
  if ("error" in goalResult) return goalResult;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "notAuthenticated" };

  const { data, error } = await supabase
    .from("payment_methods")
    .update({ name: nameResult.name, icon: iconResult.icon, monthly_goal: goalResult.monthlyGoal })
    .eq("id", id)
    .eq("owner_id", user.id)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "notFound" };

  revalidatePath("/settings");
  revalidatePath("/ledger");
  return { paymentMethod: toPaymentMethod(data) };
}

export async function setPaymentMethodGoal(
  id: string,
  monthlyGoal: number | null
): Promise<PaymentMethodActionResult> {
  if (monthlyGoal !== null && (!Number.isFinite(monthlyGoal) || monthlyGoal < 0)) {
    return { error: "invalidGoal" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "notAuthenticated" };

  const { data, error } = await supabase
    .from("payment_methods")
    .update({ monthly_goal: monthlyGoal })
    .eq("id", id)
    .eq("owner_id", user.id)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "notFound" };

  revalidatePath("/settings");
  revalidatePath("/ledger");
  return { paymentMethod: toPaymentMethod(data) };
}

export async function deletePaymentMethod(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "notAuthenticated" };

  const { data, error } = await supabase
    .from("payment_methods")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "notFound" };

  revalidatePath("/settings");
  revalidatePath("/ledger");
  return {};
}
