"use server";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { passwordViolations, type PasswordRule } from "@/lib/auth/password-policy";

export type SignUpState = {
  ok?: boolean;
  email?: string;
  /** Rules the submitted password failed (server-side check). */
  passwordViolations?: PasswordRule[];
  /** Raw error message from Supabase Auth, if any. */
  error?: string;
};

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const forwardedHost = h.get("x-forwarded-host");
  const host = forwardedHost?.split(",")[0].trim() || h.get("host");
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() || (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signUp(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email) return { error: "Email is required" };

  // Enforced here, not only in the form: the client hints are a convenience.
  const violations = passwordViolations(password);
  if (violations.length > 0) return { passwordViolations: violations };

  const locale = await getLocale();
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await requestOrigin()}/api/auth/callback?next=/${locale}/calendar`,
    },
  });
  if (error) return { error: error.message };
  return { ok: true, email };
}
