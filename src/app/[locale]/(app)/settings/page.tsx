"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useBrandColor } from "@/components/theme/brand-color-provider";
import { ConnectionManager } from "@/components/connections/connection-manager";
import { TelegramLink } from "@/components/settings/telegram-link";
import { BrandColorPicker } from "@/components/settings/brand-color-picker";
import { SignOutButton } from "@/components/settings/sign-out-button";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { useTranslations } from "next-intl";

export default function SettingsPage() {
  const { brandColor, setBrandColor } = useBrandColor();
  const tNav = useTranslations("nav");
  const t = useTranslations("settings");
  const [userId, setUserId] = useState<string | null>(null);
  const [receivedInvitations, setReceivedInvitations] = useState<
    Array<{ id: string; inviterEmail: string }>
  >([]);
  const [connections, setConnections] = useState<Array<{ id: string; partnerEmail: string }>>([]);
  const [telegramConnected, setTelegramConnected] = useState<boolean>(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    supabase
      .from("connection_invitations")
      .select("id, profiles!connection_invitations_inviter_id_fkey(email)")
      .eq("status", "pending")
      .eq("invitee_id", userId)
      .then(({ data }) => {
        setReceivedInvitations(
          (data ?? []).map((row) => ({
            id: row.id,
            inviterEmail: (row as unknown as { profiles: { email: string } }).profiles.email,
          }))
        );
      });

    supabase
      .from("connection_members")
      .select("connection_id")
      .eq("user_id", userId)
      .then(async ({ data: memberships }) => {
        const connectionIds = (memberships ?? []).map((m) => m.connection_id);
        if (connectionIds.length === 0) return;

        const { data: otherMembers } = await supabase
          .from("connection_members")
          .select("connection_id, profiles(email)")
          .in("connection_id", connectionIds)
          .neq("user_id", userId);

        setConnections(
          (otherMembers ?? []).map((row) => ({
            id: row.connection_id,
            partnerEmail: (row as unknown as { profiles: { email: string } }).profiles.email,
          }))
        );
      });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    supabase
      .from("profiles")
      .select("telegram_chat_id")
      .eq("id", userId)
      .single()
      .then(({ data }) => setTelegramConnected(!!data?.telegram_chat_id));

    // Live status: flips to "connected" as soon as the webhook stores the chat id.
    const channel = supabase
      .channel("profile-" + userId)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: "id=eq." + userId },
        (payload) =>
          setTelegramConnected(!!(payload.new as { telegram_chat_id?: string | null }).telegram_chat_id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  async function handleBrandColorChange(value: string) {
    setBrandColor(value);
    if (!userId) return;
    await createClient().from("profiles").update({ brand_color: value }).eq("id", userId);
  }

  return (
    <main className="flex flex-col gap-4 pb-8">
      <PageHeader title={tNav("settings")} />

      <Card className="flex flex-col gap-5">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink">
          <span aria-hidden>🎨</span> {t("themeSection")}
        </h2>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-ink-muted">{t("mode")}</span>
          <ThemeToggle />
        </div>
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium text-ink-muted">{t("brandColor")}</span>
          <BrandColorPicker value={brandColor} onChange={handleBrandColorChange} />
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink">
          <span aria-hidden>💞</span> {t("connectionSection")}
        </h2>
        <ConnectionManager receivedInvitations={receivedInvitations} connections={connections} />
      </Card>

      <Card>
        <TelegramLink connected={telegramConnected} onDisconnected={() => setTelegramConnected(false)} />
      </Card>

      <SignOutButton />
    </main>
  );
}
