import type { SupabaseClient } from "@supabase/supabase-js";

/** 같은 건을 수정해 알림이 이미 나간 뒤 이 시간 안의 재수정은 알림을 보내지 않는다. */
export const UPDATE_NOTIFY_WINDOW_MS = 2 * 60 * 1000;

/** Pure decision: should an "updated" notification go out given when the last one did? */
export function isOutsideNotifyWindow(lastNotifiedAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!lastNotifiedAt) return true;
  const last = Date.parse(lastNotifiedAt);
  if (Number.isNaN(last)) return true;
  return now - last >= UPDATE_NOTIFY_WINDOW_MS;
}

type LooseClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => { maybeSingle: () => Promise<{ data: { last_notified_at: string | null } | null }> };
    };
    update: (values: Record<string, unknown>) => { eq: (col: string, val: string) => Promise<unknown> };
  };
};

/**
 * 수정 알림 스로틀: 마지막 알림(생성 포함)으로부터 2분이 안 지났으면 false.
 * 보내도 되면 last_notified_at 을 지금으로 갱신하고 true. 건너뛴 수정은 창을 연장하지 않는다.
 * 실패하면 알림 누락보다 중복이 낫기 때문에 true.
 */
export async function claimUpdateNotification(
  supabase: SupabaseClient<any, any, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  table: "transactions" | "events",
  id: string
): Promise<boolean> {
  try {
    const db = supabase as unknown as LooseClient;
    const { data } = await db.from(table).select("last_notified_at").eq("id", id).maybeSingle();
    if (!isOutsideNotifyWindow(data?.last_notified_at)) return false;
    await db.from(table).update({ last_notified_at: new Date().toISOString() }).eq("id", id);
    return true;
  } catch {
    return true;
  }
}
