"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useBrandColor } from "@/components/theme/brand-color-provider";

export default function SettingsPage() {
  const { brandColor, setBrandColor } = useBrandColor();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  async function handleBrandColorChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setBrandColor(value);
    if (!userId) return;
    await createClient().from("profiles").update({ brand_color: value }).eq("id", userId);
  }

  return (
    <main>
      <ThemeToggle />
      <input type="color" value={brandColor} onChange={handleBrandColorChange} />
    </main>
  );
}
