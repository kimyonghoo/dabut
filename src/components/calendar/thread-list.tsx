"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Clock, MapPin, Search, Users } from "lucide-react";
import { dateGroupLabel } from "@/lib/dates/relative-day";
import { useTodayKey } from "@/lib/dates/use-today-key";
import { quickDeleteEvent } from "@/lib/actions/swipe-delete";
import { Link } from "@/i18n/navigation";
import { SwipeToDelete } from "@/components/swipe/swipe-to-delete";
import { useOptimisticRemoval } from "@/components/swipe/use-optimistic-removal";
import { inputClass } from "@/components/ui/field";
import { FilterDisclosure } from "@/components/ui/filter-disclosure";
import { filterEventsBySearch } from "@/lib/calendar/filter-events-by-search";
import { filterEventsByOwner, type EventOwnerFilter } from "@/lib/calendar/filter-events-by-owner";
import { eventEditHref, isVirtualOccurrence } from "@/lib/calendar/event-link";
import { BADGE_CLASSNAME, CATEGORY_KEY, DOT_CLASSNAME } from "./category-style";

const chipClass =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<EventOwnerFilter | null>(null);
  const { isRemoved, remove } = useOptimisticRemoval(quickDeleteEvent, "eventDeleted");

  // Prefer the partner's real nickname over the generic "상대방 일정" label
  // when we have one (same precedent as the ledger's OwnershipLegend and
  // Settings' nickname threading); fall back to the generic label otherwise.
  function categoryLabel(category: ThreadEvent["category"]): string {
    if (category === "partner" && partnerName) return t("categoryPartnerNamed", { name: partnerName });
    return t(CATEGORY_KEY[category]);
  }

  // Owner filter composes with search (AND): a 공통(shared) event passes
  // under either "mine" or "partner" (see filterEventsByOwner) — the
  // consistent choice given a shared event already renders identically on
  // both sides of the day-summary modal, rather than being orphaned under
  // neither filter.
  const visible = groups
    .map((group) => ({
      ...group,
      events: filterEventsBySearch(
        filterEventsByOwner(
          group.events.filter((event) => !isRemoved(event.id)),
          ownerFilter
        ),
        searchQuery
      ),
    }))
    .filter((group) => group.events.length > 0);

  const activeFilterCount = (searchQuery.trim() ? 1 : 0) + (ownerFilter ? 1 : 0);
  const chipStyle = (active: boolean) =>
    `${chipClass} ${
      active ? "border-brand bg-brand-soft text-brand-strong" : "border-line bg-surface text-ink hover:bg-surface-2"
    }`;

  return (
    <div className="flex flex-col gap-4">
      <FilterDisclosure label={t("filtersLabel")} activeCount={activeFilterCount}>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className={`${inputClass} pl-9`}
          />
        </div>
        <div
          role="radiogroup"
          aria-label={t("ownerFilterLabel")}
          onPointerDownCapture={(event) => event.stopPropagation()}
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <button
            type="button"
            role="radio"
            aria-checked={ownerFilter === null}
            onClick={() => setOwnerFilter(null)}
            className={chipStyle(ownerFilter === null)}
          >
            {t("filterAll")}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={ownerFilter === "mine"}
            onClick={() => setOwnerFilter("mine")}
            className={chipStyle(ownerFilter === "mine")}
          >
            {t(CATEGORY_KEY.mine)}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={ownerFilter === "partner"}
            onClick={() => setOwnerFilter("partner")}
            className={chipStyle(ownerFilter === "partner")}
          >
            {categoryLabel("partner")}
          </button>
        </div>
      </FilterDisclosure>
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
                    // A computed recurring occurrence has no real row to
                    // quick-delete via swipe (deleting it needs the
                    // this-one/all-series prompt, which a swipe gesture
                    // can't present) — route it to the edit screen instead,
                    // where that prompt is available.
                    disabled={event.ownerId !== currentUserId || isVirtualOccurrence(event.id)}
                    deleteLabel={tCommon("delete")}
                    onDelete={() => remove(event.id)}
                    className="rounded-2xl"
                    contentClassName="rounded-2xl bg-surface"
                  >
                    <Link
                      href={eventEditHref(event.id, "thread")}
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
