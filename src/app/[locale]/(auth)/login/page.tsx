"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Link, useRouter } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass, errorClass } from "@/components/ui/field";

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }
    router.push("/calendar");
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
              autoComplete="current-password"
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
      <p className="text-center text-sm text-ink-muted">
        {t.has("noAccount") ? t("noAccount") : "Don't have an account?"}{" "}
        <Link href="/signup" className="font-semibold text-brand hover:underline">
          {t.has("toSignup") ? t("toSignup") : "Sign up"}
        </Link>
      </p>
    </main>
  );
}
