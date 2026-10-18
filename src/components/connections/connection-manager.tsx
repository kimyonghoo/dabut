"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import {
  searchProfileByEmail,
  sendConnectionInvitation,
  acceptConnectionInvitation,
  type SearchState,
} from "@/lib/actions/connections";
import { buttonClass } from "@/components/ui/button";
import { inputClass, labelClass, errorClass } from "@/components/ui/field";

function initials(text: string) {
  const name = (text.split("@")[0] ?? text).replace(/[^\p{L}\p{N}]/gu, "");
  return (name.slice(0, 2) || "?").toUpperCase();
}

function Avatar({ label, tone }: { label: string; tone: "brand" | "partner" }) {
  return (
    <span
      aria-hidden
      className={`grid h-11 w-11 place-items-center rounded-full border-[3px] border-surface text-sm font-bold text-white shadow-sm ${
        tone === "brand" ? "bg-brand" : "bg-partner"
      }`}
    >
      {label}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{children}</h3>;
}

export function ConnectionManager({
  receivedInvitations,
  connections,
}: {
  receivedInvitations: Array<{ id: string; inviterEmail: string }>;
  connections: Array<{ id: string; partnerEmail: string }>;
}) {
  const t = useTranslations("connections");
  const [state, formAction] = useActionState<SearchState, FormData>(searchProfileByEmail, {});
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleInvite(inviteeId: string) {
    setActionError(null);
    const result = await sendConnectionInvitation(inviteeId);
    if (result.error) setActionError(result.error);
  }

  async function handleAccept(invitationId: string) {
    setActionError(null);
    const result = await acceptConnectionInvitation(invitationId);
    if (result.error) setActionError(result.error);
  }

  return (
    <div className="flex flex-col gap-5">
      {connections.length > 0 && (
        <div>
          <SectionTitle>{t("connectedWith")}</SectionTitle>
          <ul className="flex flex-col gap-2">
            {connections.map((connection) => (
              <li
                key={connection.id}
                className="flex items-center gap-3 rounded-2xl bg-shared-soft px-3 py-3"
              >
                <span className="relative flex shrink-0 items-center">
                  <Avatar label="ME" tone="brand" />
                  <span className="-ml-3">
                    <Avatar label={initials(connection.partnerEmail)} tone="partner" />
                  </span>
                  <span
                    aria-hidden
                    className="absolute left-1/2 top-1/2 grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-surface text-[11px] shadow-sm"
                  >
                    💗
                  </span>
                </span>
                <span className="min-w-0 truncate text-sm font-medium text-ink">
                  {connection.partnerEmail}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form action={formAction} >
        <div className="flex items-end gap-2">
          <label className={`${labelClass} min-w-0 flex-1`}>
            {t("searchLabel")}
            <input
              type="email"
              name="email"
              placeholder={t("searchPlaceholder")}
              required
              className={inputClass}
            />
          </label>
          <button type="submit" className={buttonClass("primary", "shrink-0")}>
            <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2}>
              <circle cx="9" cy="9" r="5.5" />
              <path d="M13.2 13.2L17 17" strokeLinecap="round" />
            </svg>
            {t("searchButton")}
          </button>
        </div>
      </form>

      {state.error && <p role="alert" className={errorClass}>{state.error}</p>}
      {actionError && <p role="alert" className={errorClass}>{actionError}</p>}

      {state.results && state.results.length > 0 && (
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {state.results.map((result) => (
            <li key={result.id} className="flex items-center gap-3 bg-surface px-3 py-2.5">
              <Avatar label={initials(result.display_name ?? "")} tone="partner" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                {result.display_name}
              </span>
              <button
                type="button"
                onClick={() => handleInvite(result.id)}
                className={buttonClass("secondary", "shrink-0 px-3 py-1.5 text-xs")}
              >
                💌 {t("invite")}
              </button>
            </li>
          ))}
        </ul>
      )}

      {receivedInvitations.length > 0 && (
        <div>
          <SectionTitle>{t("pendingReceived")}</SectionTitle>
          <ul className="flex flex-col gap-2">
            {receivedInvitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex items-center gap-3 rounded-2xl border border-dashed border-brand/40 bg-brand-soft px-3 py-2.5"
              >
                <span aria-hidden className="text-xl">💌</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                  {invitation.inviterEmail}
                </span>
                <button
                  type="button"
                  onClick={() => handleAccept(invitation.id)}
                  className={buttonClass("primary", "shrink-0 px-3 py-1.5 text-xs")}
                >
                  {t("accept")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
