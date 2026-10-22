"use server";

import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "@/i18n/navigation";
import { passwordViolations, type PasswordRule } from "@/lib/auth/password-policy";
import { nicknameViolations, normalizeNickname, type NicknameRule } from "@/lib/auth/nickname-policy";
import {
  MAX_OTP_ATTEMPTS,
  SIGNUP_LINK_TTL_MS,
  SIGNUP_STALE_TTL_MS,
  futureIso,
  isExpired,
  otpMatches,
  generateSignupToken,
} from "@/lib/auth/signup-otp";

export type SignUpState = {
  ok?: boolean;
  email?: string;
  /** Deep-link token identifying the pending signup_verifications row. */
  token?: string;
  /** `https://t.me/<bot>?start=signup_<token>` — open to receive the OTP. */
  telegramUrl?: string;
  /** Rules the submitted password failed (server-side check). */
  passwordViolations?: PasswordRule[];
  /** Rules the submitted nickname failed (server-side check). */
  nicknameViolations?: NicknameRule[];
  /** "emailRequired" | "emailExists" | "nicknameTaken" | "failed" */
  error?: string;
};

export type VerifySignupState = {
  error?: "expired" | "notFound" | "tooManyAttempts" | "invalid" | "failed";
};

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * Creates the auth user as unconfirmed and returns its id, reclaiming an
 * abandoned same-email signup attempt if one is stale enough. Never sends
 * Supabase's own confirmation email (admin.createUser doesn't).
 */
async function createUnconfirmedUser(
  admin: ServiceClient,
  email: string,
  password: string
): Promise<{ ok: true; userId: string } | { ok: false; error: "emailExists" | "failed" }> {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: false });
  if (!error && data.user) return { ok: true, userId: data.user.id };

  const isDuplicate =
    error?.code === "email_exists" ||
    error?.code === "user_already_exists" ||
    /already.*registered|already.*exists/i.test(error?.message ?? "");
  if (!isDuplicate) {
    console.error("startSignup: createUser failed:", error?.message);
    return { ok: false, error: "failed" };
  }

  // An account with this email exists already. Decide whether it's a
  // genuine confirmed account (tell the user to log in instead) or an
  // abandoned, still-unconfirmed signup attempt stale enough to reclaim.
  const { data: profile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (!profile) {
    // Shouldn't happen (handle_new_user creates the profile row at the same
    // time as the auth user), but fail closed rather than guess.
    return { ok: false, error: "emailExists" };
  }

  const { data: existing } = await admin.auth.admin.getUserById(profile.id);
  const isConfirmed = !!existing?.user?.email_confirmed_at;
  if (isConfirmed) return { ok: false, error: "emailExists" };

  const { data: pending } = await admin
    .from("signup_verifications")
    .select("created_at")
    .eq("user_id", profile.id)
    .maybeSingle();
  const pendingSince = pending?.created_at ?? existing?.user?.created_at ?? null;
  const isStale = !pendingSince || Date.now() - new Date(pendingSince).getTime() > SIGNUP_STALE_TTL_MS;
  if (!isStale) return { ok: false, error: "emailExists" };

  // Reclaim: delete the abandoned auth user (cascades to its
  // signup_verifications row via the FK) and create a fresh one.
  const { error: deleteError } = await admin.auth.admin.deleteUser(profile.id);
  if (deleteError) {
    console.error("startSignup: failed to delete stale user:", deleteError.message);
    return { ok: false, error: "failed" };
  }

  const retry = await admin.auth.admin.createUser({ email, password, email_confirm: false });
  if (retry.error || !retry.data.user) {
    console.error("startSignup: createUser retry failed:", retry.error?.message);
    return { ok: false, error: "failed" };
  }
  return { ok: true, userId: retry.data.user.id };
}

// Postgres error code for a unique-constraint violation — used as a backstop
// in case of a race between the pre-check below and the display_name update
// (e.g. two signups picking the same nickname at the same moment).
const UNIQUE_VIOLATION = "23505";

/**
 * Step 1 of signup: creates the auth user as unconfirmed (service role —
 * never the public client, which would send Supabase's own confirmation
 * email) and a fresh signup_verifications row keyed by a high-entropy
 * token. The client opens `telegramUrl`; the Telegram webhook then
 * generates and sends the OTP (see handle-signup-start.ts).
 */
export async function startSignup(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nickname = normalizeNickname(String(formData.get("nickname") ?? ""));

  if (!email) return { error: "emailRequired" };

  // Enforced here, not only in the form: the client hints are a convenience.
  const violations = passwordViolations(password);
  if (violations.length > 0) return { passwordViolations: violations };

  const nickViolations = nicknameViolations(nickname);
  if (nickViolations.length > 0) return { nicknameViolations: nickViolations };

  const admin = createServiceClient();

  // Pre-check uniqueness (case-insensitive) before creating a throwaway auth
  // user for a nickname that's already taken. The allowed nickname charset
  // (letters/numbers only, see nickname-policy.ts) has no `%`/`_` wildcards,
  // so a plain ilike is a safe case-insensitive exact match here.
  const { data: nicknameTaken } = await admin
    .from("profiles")
    .select("id")
    .ilike("display_name", nickname)
    .maybeSingle();
  if (nicknameTaken) return { error: "nicknameTaken" };

  const created = await createUnconfirmedUser(admin, email, password);
  if (!created.ok) return { error: created.error };

  // handle_new_user() inserts the profile row with display_name = '';
  // set the real nickname now. A unique-index hit here means someone else
  // grabbed the same nickname between the pre-check above and this update
  // (race) — roll back the auth user we just created so the email isn't
  // squatted by a half-finished signup.
  const { error: nicknameError } = await admin
    .from("profiles")
    .update({ display_name: nickname })
    .eq("id", created.userId);
  if (nicknameError) {
    await admin.auth.admin.deleteUser(created.userId).catch(() => undefined);
    if (nicknameError.code === UNIQUE_VIOLATION) return { error: "nicknameTaken" };
    console.error("startSignup: failed to set nickname:", nicknameError.message);
    return { error: "failed" };
  }

  const token = generateSignupToken();
  const { error: insertError } = await admin.from("signup_verifications").insert({
    token,
    user_id: created.userId,
    link_expires_at: futureIso(SIGNUP_LINK_TTL_MS),
  });
  if (insertError) {
    console.error("startSignup: failed to store verification row:", insertError.message);
    // Roll back the just-created auth user so the email isn't squatted by a
    // half-finished signup.
    await admin.auth.admin.deleteUser(created.userId).catch(() => undefined);
    return { error: "failed" };
  }

  return {
    ok: true,
    email,
    token,
    telegramUrl: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=signup_${token}`,
  };
}

// redirect() throws NEXT_REDIRECT — must be the last call, outside try/catch.
async function redirectToLedger(): Promise<never> {
  return redirect({
    href: { pathname: "/ledger", query: { toast: "telegramSignupVerified" } },
    locale: await getLocale(),
  });
}

/**
 * Step 2 of signup: verifies the OTP the user received in Telegram, then
 * confirms the auth user, links the Telegram chat (completing account
 * linking in the same step) and signs the user in.
 */
export async function verifySignupOtp(
  token: string,
  otp: string,
  email: string,
  password: string
): Promise<VerifySignupState> {
  if (!token || !/^\d{6}$/.test(otp)) return { error: "invalid" };

  const admin = createServiceClient();
  const { data: row } = await admin
    .from("signup_verifications")
    .select("user_id, otp_hash, telegram_chat_id, attempts, link_expires_at, otp_expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!row) return { error: "notFound" };

  if (isExpired(row.link_expires_at)) {
    await admin.from("signup_verifications").delete().eq("token", token);
    return { error: "expired" };
  }

  // No OTP generated yet, or it expired: same remedy either way (re-tap the
  // Telegram deep link to get a fresh one).
  if (!row.otp_hash || isExpired(row.otp_expires_at)) {
    return { error: "expired" };
  }

  if (row.attempts >= MAX_OTP_ATTEMPTS) {
    await admin.from("signup_verifications").delete().eq("token", token);
    return { error: "tooManyAttempts" };
  }

  if (!otpMatches(token, otp, row.otp_hash)) {
    const nextAttempts = row.attempts + 1;
    if (nextAttempts >= MAX_OTP_ATTEMPTS) {
      await admin.from("signup_verifications").delete().eq("token", token);
      return { error: "tooManyAttempts" };
    }
    await admin.from("signup_verifications").update({ attempts: nextAttempts }).eq("token", token);
    return { error: "invalid" };
  }

  const { error: confirmError } = await admin.auth.admin.updateUserById(row.user_id, { email_confirm: true });
  if (confirmError) {
    console.error("verifySignupOtp: confirm failed:", confirmError.message);
    return { error: "failed" };
  }

  if (row.telegram_chat_id) {
    const { error: linkError } = await admin
      .from("profiles")
      .update({ telegram_chat_id: row.telegram_chat_id })
      .eq("id", row.user_id);
    if (linkError) console.error("verifySignupOtp: telegram link failed:", linkError.message);
  }

  await admin.from("signup_verifications").delete().eq("token", token);

  // Establish the real session via cookies using the regular (non-admin)
  // server client — the admin client never touches session state.
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    console.error("verifySignupOtp: sign-in after verification failed:", signInError.message);
    return { error: "failed" };
  }

  return redirectToLedger();
}
