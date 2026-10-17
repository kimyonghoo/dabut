"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { generateTelegramLinkCode, unlinkTelegram } from "@/lib/actions/telegram";

export function TelegramLink({
  connected,
  onDisconnected,
}: {
  connected: boolean;
  onDisconnected?: () => void;
}) {
  const t = useTranslations("telegram");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleConnect() {
    setError(null);
    // Open the window synchronously (inside the click) so popup blockers
    // don't swallow it, then point it at the deep link once we have it.
    const popup = window.open("", "_blank");
    startTransition(async () => {
      const result = await generateTelegramLinkCode();
      if (result.url) {
        if (popup) popup.location.href = result.url;
        else window.location.href = result.url;
      } else {
        popup?.close();
        setError(result.error ?? "Unknown error");
      }
    });
  }

  function handleDisconnect() {
    setError(null);
    startTransition(async () => {
      const result = await unlinkTelegram();
      if (result.error) setError(result.error);
      else onDisconnected?.();
    });
  }

  return (
    <section>
      <h2>{t("title")}</h2>
      <p>{connected ? t("connected") : t("notConnected")}</p>
      {connected ? (
        <button type="button" onClick={handleDisconnect} disabled={pending}>
          {t("disconnectButton")}
        </button>
      ) : (
        <button type="button" onClick={handleConnect} disabled={pending}>
          {t("connectButton")}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
