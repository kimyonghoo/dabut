"use client";

import { startTransition, useEffect, useState, useTransition, useActionState } from "react";
import { useTranslations } from "next-intl";
import { startSignup, verifySignupOtp, type SignUpState } from "@/lib/actions/auth";
import { isPasswordValid } from "@/lib/auth/password-policy";
import { isNicknameValid, nicknameViolations } from "@/lib/auth/nickname-policy";
import { Link } from "@/i18n/navigation";
import { TooltipInput } from "@/components/ui/tooltip-input";
import { Spinner } from "@/components/ui/submit-button";
import { doneProgress, startProgress } from "@/components/feedback/progress-store";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import {
  authFieldWrap,
  authLabelClass,
  authInputClass,
  authButtonClass,
  authErrorClass,
} from "@/components/auth/auth-field";

const stepPillClass =
  "self-start rounded-full bg-brand-soft px-2.5 py-1 text-[10px] font-bold tracking-wide text-brand-strong";

export default function SignupPage() {
  const t = useTranslations("auth.signup");
  const tp = useTranslations("passwordPolicy");
  const tn = useTranslations("nickname");
  const [state, formAction, pending] = useActionState<SignUpState, FormData>(startSignup, {});
  const [step, setStep] = useState<"form" | "verify">("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyPending, startVerifyTransition] = useTransition();

  const passwordValid = isPasswordValid(password);
  // Server-side rejections are shown even if the client check was bypassed.
  const serverRejectedPassword = (state.passwordViolations?.length ?? 0) > 0;
  const showPasswordError = (attempted && !passwordValid) || serverRejectedPassword;

  const nicknameValid = isNicknameValid(nickname);
  const serverRejectedNickname = (state.nicknameViolations?.length ?? 0) > 0;
  const showNicknameError = (attempted && !nicknameValid) || serverRejectedNickname;
  const nicknameErrorKey = nicknameViolations(nickname)[0] ?? state.nicknameViolations?.[0];

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
    if (!passwordValid || !nicknameValid) return;
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
    <p className="mt-6 text-center text-sm text-ink-muted">
      {t.has("haveAccount") ? t("haveAccount") : "Already have an account?"}{" "}
      <Link href="/login" className="font-semibold text-brand hover:underline">
        {t.has("toLogin") ? t("toLogin") : "Log in"}
      </Link>
    </p>
  );

  if (step === "verify" && state.telegramUrl) {
    return (
      <main className="flex flex-1 flex-col">
        <h1 className="sr-only">{t("verifyTitle")}</h1>
        <span className={stepPillClass}>{t("step2")}</span>
        <p className="mt-3.5 text-[13px] leading-relaxed text-ink-muted">{t("verifyInstructions")}</p>
        <a href={state.telegramUrl} target="_blank" rel="noopener noreferrer" className={`${authButtonClass} mt-5 block text-center`}>
          {t("openTelegramButton")}
        </a>
        <form onSubmit={handleVerifySubmit} className="mt-7 flex flex-col gap-5">
          <div className={authFieldWrap}>
            <label className={authLabelClass} htmlFor="signup-otp">
              {t("otpLabel")}
            </label>
            <TooltipInput
              id="signup-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder={t("otpPlaceholder")}
              className={authInputClass}
              value={otp}
              onChange={(e) => {
                setVerifyError(null);
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
              }}
              required
              messages={{ valueMissing: t("otpRequired") }}
            />
          </div>
          {verifyError && (
            <p role="alert" className={authErrorClass}>
              {t(`verifyError.${verifyError}`)}
            </p>
          )}
          <button
            type="submit"
            disabled={verifyPending || otp.length !== 6}
            aria-busy={verifyPending}
            className={`${authButtonClass} flex items-center justify-center gap-2`}
          >
            {verifyPending && <Spinner />}
            {t("verifySubmit")}
          </button>
        </form>
        <p className="mt-5 text-center text-xs text-ink-muted">{t("resendHint")}</p>
        <button type="button" onClick={handleBack} className="mt-3 text-center text-sm font-semibold text-brand hover:underline">
          {t("backButton")}
        </button>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <h1 className="sr-only">{t("title")}</h1>
      <span className={stepPillClass}>{t("step1")}</span>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-1 flex-col gap-5">
        <div className={authFieldWrap}>
          <label className={authLabelClass} htmlFor="signup-email">
            {t("email")}
          </label>
          <TooltipInput
            id="signup-email"
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
          <label className={authLabelClass} htmlFor="signup-password">
            {t("password")}
          </label>
          <TooltipInput
            id="signup-password"
            type="password"
            name="password"
            autoComplete="new-password"
            className={authInputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={showPasswordError || undefined}
            aria-describedby="password-requirements"
            required
            messages={{ valueMissing: t("passwordRequired") }}
          />
        </div>
        <PasswordRequirements id="password-requirements" password={password} showErrors={attempted || serverRejectedPassword} />
        {showPasswordError && (
          <p role="alert" className={authErrorClass}>
            {tp("invalid")}
          </p>
        )}
        <div className={authFieldWrap}>
          <label className={authLabelClass} htmlFor="signup-nickname">
            {tn("label")}
          </label>
          <TooltipInput
            id="signup-nickname"
            type="text"
            name="nickname"
            autoComplete="nickname"
            placeholder={tn("placeholder")}
            className={authInputClass}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            aria-invalid={showNicknameError || undefined}
            aria-describedby="nickname-error"
            required
            messages={{ valueMissing: tn("required") }}
          />
        </div>
        {showNicknameError && nicknameErrorKey && (
          <p id="nickname-error" role="alert" className={authErrorClass}>
            {tn(nicknameErrorKey)}
          </p>
        )}
        {state.error && (
          <p role="alert" className={authErrorClass}>
            {state.error === "nicknameTaken" ? tn("taken") : t.has(state.error) ? t(state.error) : state.error}
          </p>
        )}
        <button type="submit" disabled={pending} aria-busy={pending} className={`${authButtonClass} mt-1 flex items-center justify-center gap-2`}>
          {pending && <Spinner />}
          {t("submit")}
        </button>
      </form>
      {toLogin}
    </main>
  );
}
