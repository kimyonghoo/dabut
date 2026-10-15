import { useTranslations } from "next-intl";
import { getMonthGridDays } from "@/lib/calendar/month-grid";
import type { Database } from "@/types/database.types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type CategorizedEvent = EventRow & { category: "mine" | "partner" | "shared" };

const CATEGORY_CLASSNAME: Record<CategorizedEvent["category"], string> = {
  mine: "bg-brand",
  partner: "bg-blue-200",
  shared: "bg-amber-200",
};

function isDayWithinEvent(day: Date, event: EventRow): boolean {
  const start = new Date(event.start_at);
  const end = event.end_at ? new Date(event.end_at) : start;
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
  return start <= dayEnd && end >= dayStart;
}

export function MonthView({ month, events }: { month: Date; events: CategorizedEvent[] }) {
  const t = useTranslations("calendar");
  const days = getMonthGridDays(month);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
      {days.map((day) => {
        const dayEvents = events.filter((event) => isDayWithinEvent(day, event));
        return (
          <div key={day.toISOString()}>
            <span>{day.getDate()}</span>
            <ul>
              {dayEvents.map((event) => (
                <li key={event.id} className={CATEGORY_CLASSNAME[event.category]} title={t(`category${capitalize(event.category)}` as "categoryMine")}>
                  {event.title}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function capitalize<S extends string>(value: S): Capitalize<S> {
  return (value.charAt(0).toUpperCase() + value.slice(1)) as Capitalize<S>;
}
