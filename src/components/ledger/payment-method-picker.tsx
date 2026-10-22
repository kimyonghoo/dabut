"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PaymentMethodIcon } from "@/components/ledger/payment-method-icon";

export type PickerPaymentMethod = { id: string; name: string; icon: string | null; ownerId?: string };

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
  currentUserId,
}: {
  name: string;
  methods: PickerPaymentMethod[];
  defaultValue?: string | null;
  /**
   * When provided (together with each method's `ownerId`), chips for a
   * payment method registered by someone else (a connected partner's shared
   * card, see 0019_payment_methods_shared_visibility.sql) get a small
   * "partner's" cue so it doesn't read as if the viewer registered it
   * themselves. Never shows any goal/percentage here regardless of owner.
   */
  currentUserId?: string | null;
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
          const isPartnerOwned = !!currentUserId && !!method.ownerId && method.ownerId !== currentUserId;
          return (
            <button
              key={method.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => toggle(method.id)}
              className={chipStyle(active)}
            >
              <PaymentMethodIcon icon={method.icon} name={method.name} className="size-4" />
              {method.name}
              {isPartnerOwned && <span className="text-xs text-ink-muted">({t("partnerOwned")})</span>}
            </button>
          );
        })}
      </div>
      <input type="hidden" name={name} value={selected ?? ""} />
    </div>
  );
}
