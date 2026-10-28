import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
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
          return cookieStore.getAll();
        },
        setAll: ((cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component; ignored because middleware refreshes sessions.
          }
        }) satisfies SetAllCookies,
      },
    }
  );
}
