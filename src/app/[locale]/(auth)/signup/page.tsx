"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { MailCheck } from "lucide-react";
import { signUp, type SignUpState } from "@/lib/actions/auth";
import { isPasswordValid } from "@/lib/auth/password-policy";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { inputClass, labelClass, errorClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/submit-button";
import { doneProgress, startProgress } from "@/components/feedback/progress-store";
import { PasswordRequirements } from "@/components/auth/password-requirements";

export default function SignupPage() {
  const t = useTranslations("auth.signup");
  const tp = useTranslations("passwordPolicy");
  const [state, formAction, pending] = useActionState<SignUpState, FormData>(signUp, {});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [attempted, setAttempted] = useState(false);
  const submitted = state.ok === true;
  const passwordValid = isPasswordValid(password);
  // Server-side rejections are shown even if the client check was bypassed.
  const serverRejectedPassword = (state.passwordViolations?.length ?? 0) > 0;
  const showPasswordError = (attempted && !passwordValid) || serverRejectedPassword;

  useEffect(() => {
    if (!pending) return;
    startProgress();
    return () => doneProgress();
  }, [pending]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    // Submit via a transition so React does not reset the (controlled) fields.
    e.preventDefault();
    setAttempted(true);
    if (!passwordValid) return;
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
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
            className="grid size-14 place-items-center rounded-full bg-brand-soft text-brand"
          >
            <MailCheck className="size-7" strokeWidth={1.75} />
          </span>
          <p role="status" className="text-[15px] font-medium text-ink">
            {t.has("checkEmail") ? t("checkEmail") : "Check your email to confirm your account."}
          </p>
          {state.email && <p className="text-sm text-ink-muted">{state.email}</p>}
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
              aria-invalid={showPasswordError || undefined}
              aria-describedby="password-requirements"
              required
            />
          </label>
          <PasswordRequirements
            id="password-requirements"
            password={password}
            showErrors={attempted || serverRejectedPassword}
          />
          {showPasswordError && (
            <p role="alert" className={errorClass}>
              {tp("invalid")}
            </p>
          )}
          {state.error && (
            <p role="alert" className={errorClass}>
              {state.error}
            </p>
          )}
          <Button type="submit" disabled={pending} aria-busy={pending} className="mt-1 w-full py-3 text-[15px]">
            {pending && <Spinner />}
            {t("submit")}
          </Button>
        </form>
      </Card>
      {toLogin}
    </main>
  );
}
