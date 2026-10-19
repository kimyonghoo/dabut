"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { verifyCurrentPassword } from "@/lib/actions/verify-password";
import { TooltipInput } from "@/components/ui/tooltip-input";
import { Spinner } from "@/components/ui/submit-button";
import { inputClass, labelClass, errorClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const UNLOCKED_KEY = "settings-password-gate-unlocked";

/**
 * Gates Settings behind a password re-entry — a lightweight "are you still
 * you" check for a sensitive area, not a full re-login. Unlocked state is
 * kept in sessionStorage (not plain component state): switching the locale
 * navigates to a new /[locale]/settings URL, which remounts this component,
 * and re-prompting for a password on something as incidental as a language
 * change would be absurd. sessionStorage still clears the slate for a new
 * tab/session, which is the re-prompt boundary that actually matters.
 */
export function PasswordGate({ children }: { children: ReactNode }) {
  const t = useTranslations("settings.passwordGate");
  const [unlocked, setUnlocked] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem(UNLOCKED_KEY) === "1"
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const result = await verifyCurrentPassword(password);
    setPending(false);
    if (!result.ok) {
      setError(result.error === "invalid" ? t("invalid") : t("failed"));
      return;
    }
    sessionStorage.setItem(UNLOCKED_KEY, "1");
    setUnlocked(true);
  }

  if (unlocked) return <>{children}</>;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 px-2 py-10 text-center">
      <span aria-hidden className="grid size-14 place-items-center rounded-full bg-brand-soft text-brand">
        <Lock className="size-7" strokeWidth={1.75} />
      </span>
      <div>
        <h1 className="text-lg font-bold text-ink">{t("title")}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t("instructions")}</p>
      </div>
      <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-3 text-left">
        <label className={labelClass}>
          {t("passwordLabel")}
          <TooltipInput
            type="password"
            autoFocus
            autoComplete="current-password"
            className={inputClass}
            value={password}
            onChange={(e) => {
              setError(null);
              setPassword(e.target.value);
            }}
            required
            messages={{ valueMissing: t("passwordRequired") }}
          />
        </label>
        {error && (
          <p role="alert" className={errorClass}>
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending || !password} aria-busy={pending} className="w-full py-3">
          {pending && <Spinner />}
          {t("submit")}
        </Button>
      </form>
    </main>
  );
}
