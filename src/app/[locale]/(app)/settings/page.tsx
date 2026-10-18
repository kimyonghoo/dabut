"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useBrandColor } from "@/components/theme/brand-color-provider";
import { ConnectionManager } from "@/components/connections/connection-manager";
import { TelegramLink } from "@/components/settings/telegram-link";
import { BrandColorPicker } from "@/components/settings/brand-color-picker";
import { SignOutButton } from "@/components/settings/sign-out-button";
import { LanguageSelect } from "@/components/settings/language-select";
import { DeleteAccount } from "@/components/settings/delete-account";
import { NicknameEditor } from "@/components/settings/nickname-editor";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import { HeartHandshake, Languages, Palette, Smile } from "lucide-react";

export default function SettingsPage() {
  const { brandColor, setBrandColor } = useBrandColor();
  const tNav = useTranslations("nav");
  const t = useTranslations("settings");
  const [userId, setUserId] = useState<string | null>(null);
  const [receivedInvitations, setReceivedInvitations] = useState<
    Array<{ id: string; inviterEmail: string }>
  >([]);
  const [sentInvitations, setSentInvitations] = useState<
    Array<{ id: string; inviteeEmail: string }>
  >([]);
  const [connections, setConnections] = useState<Array<{ id: string; partnerEmail: string; partnerName: string }>>(
    []
  );
  const [telegramConnected, setTelegramConnected] = useState<boolean>(false);
  const [displayName, setDisplayName] = useState<string>("");

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
      .from("connection_invitations")
      .select("id, profiles!connection_invitations_invitee_id_fkey(email)")
      .eq("status", "pending")
      .eq("inviter_id", userId)
      .then(({ data }) => {
        setSentInvitations(
          (data ?? []).map((row) => ({
            id: row.id,
            inviteeEmail: (row as unknown as { profiles: { email: string } }).profiles.email,
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
          .select("connection_id, profiles(email, display_name)")
          .in("connection_id", connectionIds)
          .neq("user_id", userId);

        setConnections(
          (otherMembers ?? []).map((row) => {
            const profile = (row as unknown as { profiles: { email: string; display_name: string } }).profiles;
            return {
              id: row.connection_id,
              partnerEmail: profile.email,
              // Nickname is required going forward, but older/untested rows
              // may still have "" — fall back to the email's local part so
              // this never renders blank.
              partnerName: profile.display_name || profile.email.split("@")[0],
            };
          })
        );
      });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    supabase
      .from("profiles")
      .select("telegram_chat_id, display_name")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        setTelegramConnected(!!data?.telegram_chat_id);
        setDisplayName(data?.display_name ?? "");
      });

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

      <Card className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink">
          <Smile aria-hidden className="size-5 text-brand" strokeWidth={2} /> {t("nicknameSection")}
        </h2>
        <NicknameEditor initialName={displayName} onSaved={setDisplayName} />
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink">
          <HeartHandshake aria-hidden className="size-5 text-brand" strokeWidth={2} /> {t("connectionSection")}
        </h2>
        <ConnectionManager
          receivedInvitations={receivedInvitations}
          sentInvitations={sentInvitations}
          connections={connections}
        />
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink">
          <Languages aria-hidden className="size-5 text-brand" strokeWidth={2} /> {t("language")}
        </h2>
        <LanguageSelect userId={userId} />
      </Card>

      <Card className="flex flex-col gap-2 py-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
            <Palette aria-hidden className="size-4 text-brand" strokeWidth={2} /> {t("themeSection")}
          </h2>
          <ThemeToggle compact />
        </div>
        <BrandColorPicker compact value={brandColor} onChange={handleBrandColorChange} />
      </Card>

      <Card>
        <TelegramLink connected={telegramConnected} onDisconnected={() => setTelegramConnected(false)} />
      </Card>

      <div className="mt-2 flex flex-col items-center gap-2">
        <SignOutButton />
        <DeleteAccount compact />
      </div>
    </main>
  );
}
