"use client";

import { useLocale, useTranslations } from "next-intl";
import { Clock, MapPin, Users } from "lucide-react";
import { dateGroupLabel } from "@/lib/dates/relative-day";
import { useTodayKey } from "@/lib/dates/use-today-key";
import { quickDeleteEvent } from "@/lib/actions/swipe-delete";
import { Link } from "@/i18n/navigation";
import { SwipeToDelete } from "@/components/swipe/swipe-to-delete";
import { useOptimisticRemoval } from "@/components/swipe/use-optimistic-removal";
import { BADGE_CLASSNAME, CATEGORY_KEY, DOT_CLASSNAME } from "./category-style";

export type ThreadEvent = {
  id: string;
  ownerId: string;
  title: string;
  location: string | null;
  companions: string | null;
  category: "mine" | "partner" | "shared";
  timeText: string;
};

export type ThreadGroup = { date: string; events: ThreadEvent[] };

export function ThreadList({
  groups,
  currentUserId,
  serverTodayKey,
  partnerName,
}: {
  groups: ThreadGroup[];
  currentUserId: string;
  serverTodayKey: string;
  partnerName?: string | null;
}) {
  const t = useTranslations("calendar");
  const tDates = useTranslations("dates");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const todayKey = useTodayKey(serverTodayKey);
  const { isRemoved, remove } = useOptimisticRemoval(quickDeleteEvent, "eventDeleted");

  // Prefer the partner's real nickname over the generic "상대방 일정" label
  // when we have one (same precedent as the ledger's OwnershipLegend and
  // Settings' nickname threading); fall back to the generic label otherwise.
  function categoryLabel(category: ThreadEvent["category"]): string {
    if (category === "partner" && partnerName) return t("categoryPartnerNamed", { name: partnerName });
    return t(CATEGORY_KEY[category]);
  }

  const visible = groups
    .map((group) => ({ ...group, events: group.events.filter((event) => !isRemoved(event.id)) }))
    .filter((group) => group.events.length > 0);

  return (
    <div className="flex flex-col gap-4">
      {visible.map((group) => {
        const today = group.date === todayKey;
        return (
          <section key={group.date} className="relative">
            <h3 className="sticky top-0 z-10 -mx-1 mb-2 bg-bg/90 px-1 py-1.5 backdrop-blur">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                  today ? "bg-brand text-white" : "bg-surface-2 text-ink"
                }`}
              >
                {dateGroupLabel(group.date, todayKey, locale, (key) => tDates(key))}
              </span>
            </h3>
            <ul className="ml-3 flex flex-col gap-2 border-l-2 border-dashed border-line pl-4">
              {group.events.map((event) => (
                <li key={event.id} className="relative">
                  <span
                    aria-hidden
                    className={`absolute -left-[1.4rem] top-4 h-2.5 w-2.5 rounded-full ring-4 ring-bg ${DOT_CLASSNAME[event.category]}`}
                  />
                  <SwipeToDelete
                    disabled={event.ownerId !== currentUserId}
                    deleteLabel={tCommon("delete")}
                    onDelete={() => remove(event.id)}
                    className="rounded-2xl"
                    contentClassName="rounded-2xl bg-surface"
                  >
                    <Link
                      href={`/calendar/${event.id}/edit`}
                      title={categoryLabel(event.category)}
                      draggable={false}
                      className="block rounded-2xl border border-line bg-surface p-3 shadow-[0_2px_10px_rgba(59,47,42,0.05)] transition hover:border-brand/40 active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate font-semibold text-ink">{event.title}</p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE_CLASSNAME[event.category]}`}
                        >
                          {categoryLabel(event.category)}
                        </span>
                      </div>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-muted">
                        <Clock aria-hidden className="size-3.5 shrink-0" />
                        {event.timeText}
                      </p>
                      {event.location && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-muted">
                          <MapPin aria-hidden className="size-3.5 shrink-0" />
                          <span className="truncate">{event.location}</span>
                        </p>
                      )}
                      {event.companions && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-muted">
                          <Users aria-hidden className="size-3.5 shrink-0" />
                          <span className="truncate">{event.companions}</span>
                        </p>
                      )}
                    </Link>
                  </SwipeToDelete>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
