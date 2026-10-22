import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { routing } from "@/i18n/routing";

const DEFAULT_NEXT = "/ko/ledger";

/** Only allow same-site relative paths ("/foo"), never "//evil.com" or "/\\evil.com". */
function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return DEFAULT_NEXT;
  }
  return next;
}

function localeFrom(path: string): string {
  const first = path.split("/").filter(Boolean)[0];
  return (routing.locales as readonly string[]).includes(first ?? "") ? first! : routing.defaultLocale;
}

function originOf(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    return `${proto.split(",")[0].trim()}://${forwardedHost.split(",")[0].trim()}`;
  }
  return new URL(request.url).origin;
}

function withToast(path: string, toast: string) {
  return `${path}${path.includes("?") ? "&" : "?"}toast=${toast}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = originOf(request);
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  try {
    const supabase = await createClient();
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      ok = !error;
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      ok = !error;
    }
  } catch {
    ok = false;
  }

  if (ok) return NextResponse.redirect(`${origin}${withToast(next, "emailConfirmed")}`);

  // Most common failure: the link was opened on another device/browser, so the
  // PKCE verifier cookie is missing. Supabase has already confirmed the email
  // by then, so just ask the user to log in.
  return NextResponse.redirect(`${origin}/${localeFrom(next)}/login?toast=emailConfirmedLogin`);
}
