import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ACTIVITY_COOKIE = "dabut_last_active";
const INACTIVITY_MS = 3 * 24 * 60 * 60 * 1000;
const ACTIVITY_REFRESH_MS = 60 * 60 * 1000;

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        // 브라우저를 닫아도 로그인 유지 (세션 쿠키가 되지 않도록 만료를 명시). iOS Safari 대응.
        maxAge: 60 * 60 * 24 * 400,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll: ((cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        }) satisfies SetAllCookies,
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const now = Date.now();
    const last = Number(request.cookies.get(ACTIVITY_COOKIE)?.value);
    if (Number.isFinite(last) && last > 0 && now - last > INACTIVITY_MS) {
      // 3일 이상 활동 없음 -> 로그아웃 (signOut이 sb-* 쿠키를 지움)
      await supabase.auth.signOut();
      response.cookies.delete(ACTIVITY_COOKIE);
    } else if (!Number.isFinite(last) || last <= 0 || now - last > ACTIVITY_REFRESH_MS) {
      response.cookies.set(ACTIVITY_COOKIE, String(now), {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 400,
      });
    }
  }

  return response;
}
