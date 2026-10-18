"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui/button";

export function SignOutButton() {
  const t = useTranslations("settings");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={pending}
      className={buttonClass("ghost", "mx-auto mt-2")}
    >
      👋 {t("signOut")}
    </button>
  );
}
