"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Send } from "lucide-react";
import { generateTelegramLinkCode, unlinkTelegram } from "@/lib/actions/telegram";
import { buttonClass } from "@/components/ui/button";
import { errorClass } from "@/components/ui/field";

export function PaperPlane({ className = "" }: { className?: string }) {
  return <Send aria-hidden className={className} />;
}

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
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-bold text-ink">
          <PaperPlane className="size-4 shrink-0 text-[#2AABEE]" />
          <span className="truncate">{t("title")}</span>
        </h2>
        {connected ? (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={pending}
            className={buttonClass("danger", "shrink-0 !px-3.5 !py-2")}
          >
            {t("disconnectButton")}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleConnect}
            disabled={pending}
            className={buttonClass("primary", "shrink-0 !px-3.5 !py-2")}
          >
            {t("connectButton")}
          </button>
        )}
      </div>
      {error && <p role="alert" className={errorClass}>{error}</p>}
    </section>
  );
}
