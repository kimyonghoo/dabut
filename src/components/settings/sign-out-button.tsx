"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useProgressRouter } from "@/components/feedback/use-progress-router";
import { doneProgress, startProgress } from "@/components/feedback/progress-store";
import { Spinner } from "@/components/ui/submit-button";
import { buttonClass } from "@/components/ui/button";

export function SignOutButton() {
  const t = useTranslations("settings");
  const router = useProgressRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    startProgress();
    await createClient()
      .auth.signOut()
      .finally(() => doneProgress());
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
      {pending ? <Spinner /> : "👋"} {t("signOut")}
    </button>
  );
}
