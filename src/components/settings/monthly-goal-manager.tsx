"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { updateMonthlySpendingGoal } from "@/lib/actions/monthly-goal";
import { buttonClass } from "@/components/ui/button";
import { inputClass, errorClass } from "@/components/ui/field";
import { Spinner } from "@/components/ui/submit-button";
import { showToast } from "@/components/feedback/toast-bus";
import { formatWonPreview, parseWon } from "@/lib/ledger/parse-won";

/**
 * "이번 달 목표 지출액" — a single goal shared by the whole connection
 * (either member can set/change it, see 0026_connection_monthly_goal.sql),
 * unlike payment methods' private per-card goals. Only rendered when the
 * user has a connection at all (see Settings page) — there's nothing to
 * share a goal on otherwise.
 */
export function MonthlyGoalManager({ initialGoal }: { initialGoal: number | null }) {
  const t = useTranslations("monthlyGoal");
  const [goal, setGoal] = useState(initialGoal);
  const [draft, setDraft] = useState(initialGoal != null ? String(initialGoal) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const draftParsed = parseWon(draft);
  const preview = "value" in draftParsed && draftParsed.value != null ? formatWonPreview(draftParsed.value) : null;

  function handleSave() {
    const parsed = parseWon(draft);
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateMonthlySpendingGoal(parsed.value);
      if (!result.ok) {
        setError(result.error);
        if (result.error === "noConnection") showToast("monthlyGoalNoConnection", "error");
        else showToast("monthlyGoalFailed", "error");
        return;
      }
      setGoal(parsed.value);
      showToast("monthlyGoalSaved");
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("placeholder")}
          aria-label={t("title")}
          className={inputClass}
        />
        <button type="button" onClick={handleSave} disabled={pending} className={buttonClass("primary", "shrink-0 !px-4 !py-2.5")}>
          {pending ? <Spinner /> : t("save")}
        </button>
      </div>
      {error && <p className={errorClass}>{t.has(error) ? t(error) : t("failed")}</p>}
      {!error && preview && <p className="text-xs text-brand">{preview}</p>}
      {!error && !preview && goal != null && (
        <p className="text-xs text-ink-muted">{t("currentGoal", { amount: formatWonPreview(goal) })}</p>
      )}
    </div>
  );
}
