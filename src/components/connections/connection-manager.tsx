"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  searchProfileByEmail,
  sendConnectionInvitation,
  acceptConnectionInvitation,
  type SearchState,
} from "@/lib/actions/connections";

export function ConnectionManager({
  receivedInvitations,
  connections,
}: {
  receivedInvitations: Array<{ id: string; inviterEmail: string }>;
  connections: Array<{ id: string; partnerEmail: string }>;
}) {
  const t = useTranslations("connections");
  const [state, formAction] = useActionState<SearchState, FormData>(searchProfileByEmail, {});

  return (
    <section>
      <form action={formAction}>
        <label>
          {t("searchLabel")}
          <input type="email" name="email" placeholder={t("searchPlaceholder")} required />
        </label>
        <button type="submit">{t("searchButton")}</button>
      </form>

      {state.error && <p role="alert">{state.error}</p>}

      {state.results && state.results.length > 0 && (
        <ul>
          {state.results.map((result) => (
            <li key={result.id}>
              {result.display_name}
              <button type="button" onClick={() => sendConnectionInvitation(result.id)}>
                {t("invite")}
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3>{t("pendingReceived")}</h3>
      <ul>
        {receivedInvitations.map((invitation) => (
          <li key={invitation.id}>
            {invitation.inviterEmail}
            <button type="button" onClick={() => acceptConnectionInvitation(invitation.id)}>
              {t("accept")}
            </button>
          </li>
        ))}
      </ul>

      <h3>{t("connectedWith")}</h3>
      <ul>
        {connections.map((connection) => (
          <li key={connection.id}>{connection.partnerEmail}</li>
        ))}
      </ul>
    </section>
  );
}
