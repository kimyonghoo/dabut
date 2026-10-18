"use client";

import { useTranslations } from "next-intl";
import { Check, Circle, X } from "lucide-react";
import { PASSWORD_MIN_LENGTH, PASSWORD_RULES, checkPassword } from "@/lib/auth/password-policy";

/**
 * Live checklist under a password field. Unmet rules turn red once
 * `showErrors` is set (after a submit attempt), otherwise stay neutral.
 */
export function PasswordRequirements({
  id,
  password,
  showErrors,
}: {
  id?: string;
  password: string;
  showErrors: boolean;
}) {
  const t = useTranslations("passwordPolicy");
  const result = checkPassword(password);

  return (
    <ul id={id} aria-live="polite" className="flex flex-col gap-1 px-1 text-xs">
      {PASSWORD_RULES.map((rule) => {
        const met = result[rule];
        const failed = !met && showErrors;
        const Icon = met ? Check : failed ? X : Circle;
        return (
          <li
            key={rule}
            className={`flex items-center gap-1.5 transition-colors ${
              met ? "text-income" : failed ? "text-expense" : "text-ink-muted"
            }`}
          >
            <Icon aria-hidden className={met || failed ? "size-3.5" : "size-2.5 mx-0.5"} strokeWidth={2.5} />
            <span>
              {t(rule, { min: PASSWORD_MIN_LENGTH })}
              <span className="sr-only"> — {met ? t("met") : t("unmet")}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
