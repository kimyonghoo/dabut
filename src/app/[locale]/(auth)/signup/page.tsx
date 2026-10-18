"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass, errorClass } from "@/components/ui/field";

export default function SignupPage() {
  const t = useTranslations("auth.signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error } = await createClient().auth.signUp({ email, password });
    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSubmitted(true);
  }

  const toLogin = (
    <p className="text-center text-sm text-ink-muted">
      {t.has("haveAccount") ? t("haveAccount") : "Already have an account?"}{" "}
      <Link href="/login" className="font-semibold text-brand hover:underline">
        {t.has("toLogin") ? t("toLogin") : "Log in"}
      </Link>
    </p>
  );

  if (submitted) {
    return (
      <main className="flex flex-col gap-4">
        <Card className="flex flex-col items-center gap-3 p-6 text-center shadow-[0_8px_30px_rgba(59,47,42,0.08)]">
          <span
            aria-hidden="true"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-2xl"
          >
            💌
          </span>
          <p role="status" className="text-[15px] font-medium text-ink">
            {t.has("checkEmail") ? t("checkEmail") : "Check your email to confirm your account."}
          </p>
          {email && <p className="text-sm text-ink-muted">{email}</p>}
        </Card>
        {toLogin}
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4">
      <Card className="p-6 shadow-[0_8px_30px_rgba(59,47,42,0.08)]">
        <h1 className="mb-5 text-center text-xl font-bold text-ink">{t("title")}</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className={labelClass}>
            {t("email")}
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className={labelClass}>
            {t("password")}
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && (
            <p role="alert" className={errorClass}>
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending} className="mt-1 w-full py-3 text-[15px]">
            {t("submit")}
          </Button>
        </form>
      </Card>
      {toLogin}
    </main>
  );
}
