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
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#2AABEE]/15 text-[#2AABEE]"
        >
          <PaperPlane className="h-5 w-5" />
        </span>
        <h2 className="min-w-0 flex-1 text-base font-bold text-ink">{t("title")}</h2>
        <p
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
            connected ? "bg-income/15 text-income" : "bg-surface-2 text-ink-muted"
          }`}
        >
          <span
            aria-hidden
            className={`h-2 w-2 rounded-full ${connected ? "bg-income animate-pulse" : "bg-ink-muted/50"}`}
          />
          {connected ? t("connected") : t("notConnected")}
        </p>
      </div>
      <p className="text-sm leading-relaxed text-ink-muted">
        {connected
          ? t.has("connectedNote")
            ? t("connectedNote")
            : "상대방이 일정·가계부를 바꾸면 이 텔레그램으로 알려드려요"
          : t.has("explain")
            ? t("explain")
            : "알림을 받으려면 내 텔레그램을 다붓 봇과 연결해요. '연결하기'를 누르면 텔레그램이 열리고, 봇 화면에서 시작(START)을 누르면 끝!"}
      </p>
      {connected ? (
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={pending}
          className={buttonClass("danger", "self-start")}
        >
          {t("disconnectButton")}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleConnect}
          disabled={pending}
          className={buttonClass("primary", "w-full")}
        >
          <PaperPlane className="h-4 w-4" />
          {t("connectButton")}
        </button>
      )}
      {error && <p role="alert" className={errorClass}>{error}</p>}
    </section>
  );
}
