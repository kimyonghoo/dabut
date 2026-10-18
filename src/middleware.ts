import { type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const supabaseResponse = await updateSession(request);
  const intlResponse = intlMiddleware(request);

  for (const cookie of supabaseResponse.cookies.getAll()) {
    intlResponse.cookies.set(cookie);
  }

  return intlResponse;
}

export const config = {
  // icon.svg (and favicon.ico) are Next's file-based icon convention, served
  // only at the true root — without this exclusion the locale middleware
  // redirected /icon.svg to /ko/icon.svg, a route that doesn't exist, which
  // silently broke the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api).*)"],
};
