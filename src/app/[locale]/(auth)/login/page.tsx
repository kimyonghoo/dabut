"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Link } from "@/i18n/navigation";
import { useProgressRouter } from "@/components/feedback/use-progress-router";
import { doneProgress, startProgress } from "@/components/feedback/progress-store";
import { Spinner } from "@/components/ui/submit-button";
import { TooltipInput } from "@/components/ui/tooltip-input";
import { authFieldWrap, authLabelClass, authInputClass, authButtonClass, authErrorClass } from "@/components/auth/auth-field";

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const router = useProgressRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    startProgress();
    const { error } = await createClient()
      .auth.signInWithPassword({ email, password })
      .finally(() => doneProgress());
    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }
    router.push("/calendar");
  }

  return (
    <main className="flex flex-1 flex-col">
      <h1 className="sr-only">{t("title")}</h1>
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5">
        <div className={authFieldWrap}>
          <label className={authLabelClass} htmlFor="login-email">
            {t("email")}
          </label>
          <TooltipInput
            id="login-email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            className={authInputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            messages={{ valueMissing: t("emailRequired"), typeMismatch: t("invalidEmail") }}
          />
        </div>
        <div className={authFieldWrap}>
          <label className={authLabelClass} htmlFor="login-password">
            {t("password")}
          </label>
          <TooltipInput
            id="login-password"
            type="password"
            name="password"
            autoComplete="current-password"
            className={authInputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            messages={{ valueMissing: t("passwordRequired") }}
          />
        </div>
        {error && (
          <p role="alert" className={authErrorClass}>
            {error}
          </p>
        )}
        <button type="submit" disabled={pending} aria-busy={pending} className={`${authButtonClass} mt-1 flex items-center justify-center gap-2`}>
          {pending && <Spinner />}
          {t("submit")}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-muted">
        {t.has("noAccount") ? t("noAccount") : "Don't have an account?"}{" "}
        <Link href="/signup" className="font-semibold text-brand hover:underline">
          {t.has("toSignup") ? t("toSignup") : "Sign up"}
        </Link>
      </p>
    </main>
  );
}
