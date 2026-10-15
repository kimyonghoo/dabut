import { useTranslations } from "next-intl";
import { groupEventsByDate } from "@/lib/calendar/group-by-date";
import type { Database } from "@/types/database.types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type CategorizedEvent = EventRow & { category: "mine" | "partner" | "shared" };

const CATEGORY_CLASSNAME: Record<CategorizedEvent["category"], string> = {
  mine: "bg-brand",
  partner: "bg-blue-200",
  shared: "bg-amber-200",
};

export function ThreadView({ events }: { events: CategorizedEvent[] }) {
  const t = useTranslations("calendar");
  const grouped = groupEventsByDate(events);

  return (
    <div>
      {grouped.map((group) => (
        <section key={group.date}>
          <h3>{group.date}</h3>
          <ul>
            {group.events.map((event) => (
              <li
                key={event.id}
                className={CATEGORY_CLASSNAME[event.category]}
                title={t(`category${event.category.charAt(0).toUpperCase()}${event.category.slice(1)}` as "categoryMine")}
              >
                {event.title}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
