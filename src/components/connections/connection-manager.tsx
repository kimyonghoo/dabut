"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Heart, Mail, Send } from "lucide-react";
import {
  searchProfileByEmail,
  sendConnectionInvitation,
  acceptConnectionInvitation,
  declineConnectionInvitation,
  cancelConnectionInvitation,
} from "@/lib/actions/connections";
import { buttonClass } from "@/components/ui/button";
import { inputClass, labelClass, errorClass } from "@/components/ui/field";
import { Spinner } from "@/components/ui/submit-button";

// Debounce delay for live search-as-you-type.
const SEARCH_DEBOUNCE_MS = 350;

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

// Error codes returned by the connections Server Actions that map to a
// translated message; any other error string is shown as-is (unexpected
// DB errors we haven't special-cased).
const LOCALIZED_ERROR_KEYS = new Set(["duplicateInvite", "pendingFromTarget", "alreadyConnected"]);

export function ConnectionManager({
  receivedInvitations,
  sentInvitations,
  connections,
}: {
  receivedInvitations: Array<{ id: string; inviterEmail: string }>;
  sentInvitations: Array<{ id: string; inviteeEmail: string }>;
  connections: Array<{ id: string; partnerEmail: string }>;
}) {
  const t = useTranslations("connections");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; display_name: string }> | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingInviteId, setPendingInviteId] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Live search-as-you-type: debounced, and stale in-flight responses are
  // ignored if the input changes again before they come back. The RPC
  // itself stays an exact, case-insensitive full-email match (see
  // search_profile_by_email in supabase/migrations/0007_email_auth.sql) —
  // this only changes *when* it's called, not what it matches.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults(null);
      setSearchError(null);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const handle = setTimeout(async () => {
      const formData = new FormData();
      formData.set("email", trimmed);
      const result = await searchProfileByEmail({}, formData);
      if (cancelled) return;
      setSearching(false);
      if (result.error) {
        setSearchError(result.error);
        setSearchResults(null);
      } else {
        setSearchError(null);
        setSearchResults(result.results ?? []);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  function showError(error: string) {
    setActionError(LOCALIZED_ERROR_KEYS.has(error) ? t(error) : error);
  }

  async function handleInvite(inviteeId: string) {
    if (pendingInviteId) return; // guard against a double-click firing two inserts
    setActionError(null);
    setPendingInviteId(inviteeId);
    try {
      const result = await sendConnectionInvitation(inviteeId);
      if (result.error) showError(result.error);
    } finally {
      setPendingInviteId(null);
    }
  }

  async function handleAccept(invitationId: string) {
    setActionError(null);
    const result = await acceptConnectionInvitation(invitationId);
    if (result.error) showError(result.error);
    else setDismissedIds((prev) => new Set(prev).add(invitationId));
  }

  async function handleDecline(invitationId: string) {
    setActionError(null);
    const result = await declineConnectionInvitation(invitationId);
    if (result.error) showError(result.error);
    else setDismissedIds((prev) => new Set(prev).add(invitationId));
  }

  async function handleCancel(invitationId: string) {
    setActionError(null);
    const result = await cancelConnectionInvitation(invitationId);
    if (result.error) showError(result.error);
    else setDismissedIds((prev) => new Set(prev).add(invitationId));
  }

  const visibleReceived = receivedInvitations.filter((i) => !dismissedIds.has(i.id));
  const visibleSent = sentInvitations.filter((i) => !dismissedIds.has(i.id));

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
                    className="absolute left-1/2 top-1/2 grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-surface text-brand shadow-sm"
                  >
                    <Heart aria-hidden className="size-3 fill-current" strokeWidth={2} />
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

      <label className={labelClass}>
        {t("searchLabel")}
        <div className="relative">
          <input
            type="email"
            name="email"
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`${inputClass} pr-10`}
          />
          {searching && (
            <span aria-hidden className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted">
              <Spinner className="size-4" />
            </span>
          )}
        </div>
      </label>

      {searchError && <p role="alert" className={errorClass}>{searchError}</p>}
      {actionError && <p role="alert" className={errorClass}>{actionError}</p>}

      {searchResults && searchResults.length > 0 && (
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {searchResults.map((result) => (
            <li key={result.id} className="flex items-center gap-3 bg-surface px-3 py-2.5">
              <Avatar label={initials(result.display_name ?? "")} tone="partner" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                {result.display_name}
              </span>
              <button
                type="button"
                onClick={() => handleInvite(result.id)}
                disabled={pendingInviteId === result.id}
                className={buttonClass("secondary", "shrink-0 px-3 py-1.5 text-xs")}
              >
                <Send aria-hidden className="size-4" strokeWidth={2} /> {t("invite")}
              </button>
            </li>
          ))}
        </ul>
      )}

      {visibleReceived.length > 0 && (
        <div>
          <SectionTitle>{t("pendingReceived")}</SectionTitle>
          <ul className="flex flex-col gap-2">
            {visibleReceived.map((invitation) => (
              <li
                key={invitation.id}
                className="flex items-center gap-3 rounded-2xl border border-dashed border-brand/40 bg-brand-soft px-3 py-2.5"
              >
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                  <Mail className="size-5" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                  {invitation.inviterEmail}
                </span>
                <button
                  type="button"
                  onClick={() => handleDecline(invitation.id)}
                  className={buttonClass("secondary", "shrink-0 px-3 py-1.5 text-xs")}
                >
                  {t("decline")}
                </button>
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

      {visibleSent.length > 0 && (
        <div>
          <SectionTitle>{t("pendingSent")}</SectionTitle>
          <ul className="flex flex-col gap-2">
            {visibleSent.map((invitation) => (
              <li
                key={invitation.id}
                className="flex items-center gap-3 rounded-2xl border border-dashed border-line bg-surface px-3 py-2.5"
              >
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-shared-soft text-ink-muted">
                  <Send className="size-5" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                  {invitation.inviteeEmail}
                </span>
                <button
                  type="button"
                  onClick={() => handleCancel(invitation.id)}
                  className={buttonClass("secondary", "shrink-0 px-3 py-1.5 text-xs")}
                >
                  {t("cancelInvite")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
