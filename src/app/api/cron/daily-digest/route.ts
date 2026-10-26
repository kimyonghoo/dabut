import { createServiceClient } from "@/lib/supabase/service";
import { zonedDateParts, tomorrowDateKeyInTimeZone, zonedDateTimeToUtcIso, DEFAULT_TIMEZONE } from "@/lib/dates/timezone";
import { tomorrowDigestMessage } from "@/lib/telegram/messages";
import { sendTelegramMessage } from "@/lib/telegram/send-message";
import { resolvePartnerName } from "@/lib/calendar/partner-name";

// Fixed send time — there's no per-user hour picker (kept simple: toggle
// on/off only), and the cron itself only fires once a day (Vercel Hobby
// plan's cron limit), so there's one global hour, not one per user.
const DIGEST_HOUR = 18;

type DigestProfile = {
  id: string;
  timezone: string | null;
  telegram_chat_id: string | null;
};

type CandidateEvent = {
  title: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  owner_id: string;
  visibility: string;
};

/**
 * "내일 뭐해?" — meant to be hit once a day by a Vercel Cron job (see
 * vercel.json), scheduled for 18:00 Asia/Seoul. Every enabled profile is
 * still checked against DIGEST_HOUR *in that profile's own timezone* rather
 * than assumed, so this keeps working correctly for a non-Seoul profile if
 * the cron schedule or plan ever changes. Silent no-op when a user has no
 * events tomorrow — this is a "here's your day" nudge, not a "nothing's
 * happening" one.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, timezone, telegram_chat_id")
    .eq("daily_digest_enabled", true)
    .not("telegram_chat_id", "is", null);

  let sent = 0;
  for (const profile of (profiles ?? []) as DigestProfile[]) {
    const timeZone = profile.timezone || DEFAULT_TIMEZONE;
    const { hour } = zonedDateParts(now.toISOString(), timeZone);
    if (hour !== DIGEST_HOUR) continue;

    const tomorrowKey = tomorrowDateKeyInTimeZone(now, timeZone);
    const rangeStart = zonedDateTimeToUtcIso(tomorrowKey, "00:00:00", timeZone);
    const rangeEnd = zonedDateTimeToUtcIso(tomorrowKey, "23:59:59", timeZone);
    const rangeStartMs = new Date(rangeStart).getTime();
    const rangeEndMs = new Date(rangeEnd).getTime();

    const { data: membership } = await supabase
      .from("connection_members")
      .select("connection_id")
      .eq("user_id", profile.id)
      .order("joined_at", { ascending: true })
      .limit(1);
    const connectionId = membership?.[0]?.connection_id ?? null;

    const orFilter = connectionId
      ? `owner_id.eq.${profile.id},connection_id.eq.${connectionId}`
      : `owner_id.eq.${profile.id}`;

    // Wide-ish window on start_at so a multi-day event starting a bit before
    // tomorrow still shows up; exact overlap is checked below in JS against
    // the real range, which is the only correctness-bearing check.
    const { data: candidates } = await supabase
      .from("events")
      .select("title, start_at, end_at, all_day, owner_id, visibility")
      .or(orFilter)
      .gte("start_at", new Date(rangeStartMs - 3 * 24 * 60 * 60 * 1000).toISOString())
      .lte("start_at", rangeEnd);

    const tomorrowEvents = ((candidates ?? []) as CandidateEvent[]).filter((event) => {
      const visibleToMe = event.owner_id === profile.id || event.visibility === "shared";
      if (!visibleToMe) return false;
      const startMs = new Date(event.start_at).getTime();
      const endMs = event.end_at ? new Date(event.end_at).getTime() : startMs;
      return startMs <= rangeEndMs && endMs >= rangeStartMs;
    });

    if (tomorrowEvents.length === 0) continue;

    const partnerName = await resolvePartnerName(supabase, profile.id);

    await sendTelegramMessage(
      profile.telegram_chat_id!,
      tomorrowDigestMessage({
        events: tomorrowEvents.map((e) => ({
          title: e.title,
          startAt: e.start_at,
          allDay: e.all_day,
          isMine: e.owner_id === profile.id,
          isShared: e.visibility === "shared",
        })),
        timeZone,
        partnerName,
      })
    );
    sent++;
  }

  return Response.json({ checked: profiles?.length ?? 0, sent });
}
