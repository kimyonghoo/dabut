import { createClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { BrandColorProvider } from "@/components/theme/brand-color-provider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const locale = await getLocale();
    return redirect({ href: "/login", locale });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("brand_color")
    .eq("id", user.id)
    .single();

  return (
    <BrandColorProvider initialColor={profile?.brand_color ?? "#FF6F61"}>
      {children}
    </BrandColorProvider>
  );
}
