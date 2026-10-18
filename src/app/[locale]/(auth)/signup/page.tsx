"use client";

import { startTransition, useEffect, useState, useTransition, useActionState } from "react";
import { useTranslations } from "next-intl";
import { Send } from "lucide-react";
import { startSignup, verifySignupOtp, type SignUpState } from "@/lib/actions/auth";
import { isPasswordValid } from "@/lib/auth/password-policy";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { inputClass, labelClass, errorClass } from "@/components/ui/field";
import { Button, buttonClass } from "@/components/ui/button";
import { Spinner } from "@/components/ui/submit-button";
import { doneProgress, startProgress } from "@/components/feedback/progress-store";
import { PasswordRequirements } from "@/components/auth/password-requirements";

export default function SignupPage() {
  const t = useTranslations("auth.signup");
  const tp = useTranslations("passwordPolicy");
  const [state, formAction, pending] = useActionState<SignUpState, FormData>(startSignup, {});
  const [step, setStep] = useState<"form" | "verify">("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyPending, startVerifyTransition] = useTransition();

  const passwordValid = isPasswordValid(password);
  // Server-side rejections are shown even if the client check was bypassed.
  const serverRejectedPassword = (state.passwordViolations?.length ?? 0) > 0;
  const showPasswordError = (attempted && !passwordValid) || serverRejectedPassword;

  useEffect(() => {
    if (state.ok && state.token && state.telegramUrl) setStep("verify");
  }, [state]);

  useEffect(() => {
    if (!pending) return;
    startProgress();
    return () => doneProgress();
  }, [pending]);

  useEffect(() => {
    if (!verifyPending) return;
    startProgress();
    return () => doneProgress();
  }, [verifyPending]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    // Submit via a transition so React does not reset the (controlled) fields.
    e.preventDefault();
    setAttempted(true);
    if (!passwordValid) return;
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  }

  function handleVerifySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!state.token) return;
    setVerifyError(null);
    startVerifyTransition(async () => {
      const result = await verifySignupOtp(state.token!, otp, email, password);
      // On success verifySignupOtp redirects server-side (throws), so this
      // line is only reached on failure.
      if (result.error) setVerifyError(result.error);
    });
  }

  function handleBack() {
    setStep("form");
    setOtp("");
    setVerifyError(null);
  }

  const toLogin = (
    <p className="text-center text-sm text-ink-muted">
      {t.has("haveAccount") ? t("haveAccount") : "Already have an account?"}{" "}
      <Link href="/login" className="font-semibold text-brand hover:underline">
        {t.has("toLogin") ? t("toLogin") : "Log in"}
      </Link>
    </p>
  );

  if (step === "verify" && state.telegramUrl) {
    return (
      <main className="flex flex-col gap-4">
        <Card className="flex flex-col gap-4 p-6 shadow-[0_8px_30px_rgba(59,47,42,0.08)]">
          <div className="flex flex-col items-center gap-3 text-center">
            <span
              aria-hidden="true"
              className="grid size-14 place-items-center rounded-full bg-brand-soft text-brand"
            >
              <Send className="size-7" strokeWidth={1.75} />
            </span>
            <h1 className="text-xl font-bold text-ink">{t("verifyTitle")}</h1>
            <p className="text-sm leading-relaxed text-ink-muted">{t("verifyInstructions")}</p>
          </div>
          <a
            href={state.telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass("primary", "w-full")}
          >
            <Send className="h-4 w-4" />
            {t("openTelegramButton")}
          </a>
          <form onSubmit={handleVerifySubmit} className="flex flex-col gap-3">
            <label className={labelClass}>
              {t("otpLabel")}
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder={t("otpPlaceholder")}
                className={inputClass}
                value={otp}
                onChange={(e) => {
                  setVerifyError(null);
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                }}
                required
              />
            </label>
            {verifyError && (
              <p role="alert" className={errorClass}>
                {t(`verifyError.${verifyError}`)}
              </p>
            )}
            <Button
              type="submit"
              disabled={verifyPending || otp.length !== 6}
              aria-busy={verifyPending}
              className="w-full py-3 text-[15px]"
            >
              {verifyPending && <Spinner />}
              {t("verifySubmit")}
            </Button>
          </form>
          <p className="text-center text-xs text-ink-muted">{t("resendHint")}</p>
          <button
            type="button"
            onClick={handleBack}
            className="text-center text-sm font-semibold text-brand hover:underline"
          >
            {t("backButton")}
          </button>
        </Card>
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
              {t.has(state.error) ? t(state.error) : state.error}
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
