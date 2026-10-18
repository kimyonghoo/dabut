"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CreditCard } from "lucide-react";

export type PickerPaymentMethod = { id: string; name: string; icon: string | null };

const chipClass =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

/**
 * One-tap payment-method chip picker for the ledger entry form, mirroring
 * CompanionPicker's chip UI exactly — except single-select: a transaction
 * has at most one payment method, so tapping the already-selected chip
 * deselects it (toggle back to "none") instead of allowing multiple.
 *
 * The value submitted with the surrounding <form> is a single hidden input
 * holding the selected payment method id, or "" for no selection (a valid,
 * optional state).
 */
export function PaymentMethodPicker({
  name,
  methods,
  defaultValue,
}: {
  name: string;
  methods: PickerPaymentMethod[];
  defaultValue?: string | null;
}) {
  const t = useTranslations("ledger");
  const [selected, setSelected] = useState<string | null>(defaultValue ?? null);

  // Nothing to pick from yet (the user hasn't added any payment methods in
  // Settings) — don't show an empty, useless field.
  if (methods.length === 0) return null;

  function toggle(id: string) {
    setSelected((prev) => (prev === id ? null : id));
  }

  const chipStyle = (active: boolean) =>
    `${chipClass} ${
      active ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-surface text-ink hover:bg-surface-2"
    }`;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink-muted">{t("paymentMethod")}</span>
      <div role="radiogroup" aria-label={t("paymentMethod")} className="flex flex-wrap gap-2">
        {methods.map((method) => {
          const active = selected === method.id;
          return (
            <button
              key={method.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => toggle(method.id)}
              className={chipStyle(active)}
            >
              {method.icon ? (
                <span aria-hidden>{method.icon}</span>
              ) : (
                <CreditCard aria-hidden className="size-4" />
              )}
              {method.name}
            </button>
          );
        })}
      </div>
      <input type="hidden" name={name} value={selected ?? ""} />
    </div>
  );
}
