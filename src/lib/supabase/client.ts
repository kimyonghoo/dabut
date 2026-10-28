import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        // 브라우저를 닫아도 로그인 유지. iOS Safari 대응.
        maxAge: 60 * 60 * 24 * 400,
        path: "/",
        sameSite: "lax",
        secure: typeof location !== "undefined" && location.protocol === "https:",
      },
    }
  );
}
