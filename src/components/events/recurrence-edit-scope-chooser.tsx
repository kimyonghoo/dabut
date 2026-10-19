"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarCheck2, CalendarRange } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Database } from "@/types/database.types";
import { EventForm } from "./event-form";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

/**
 * Samsung/Google-style prompt shown when opening an untouched occurrence of
 * a recurring event for edit/delete: "이 일정만" detaches just this cycle
 * into its own standalone event (EventForm with scope "this", prefilled from
 * `occurrenceEvent` — the computed occurrence's own start/end, not the
 * parent's stored ones); "모든 일정" edits the series' parent row directly
 * (scope "all", prefilled from `event`, recurrence section included). Both
 * choices reuse the same EventForm — only its `scope`/`occurrenceDate` props
 * and which record it's prefilled from differ.
 */
export function RecurrenceEditScopeChooser({
  event,
  occurrenceEvent,
  occurrenceDate,
  connections,
  returnView,
}: {
  /** The series' real parent row. */
  event: EventRow;
  /** A synthetic, not-yet-persisted event shaped like `event` but with this cycle's own computed start/end. */
  occurrenceEvent: EventRow;
  occurrenceDate: string;
  connections: Array<{ id: string; partnerEmail: string }>;
  /** Threaded straight through to EventForm — see its own doc for what this does. */
  returnView?: "thread";
}) {
  const t = useTranslations("events");
  const [scope, setScope] = useState<"this" | "all" | null>(null);

  if (scope === null) {
    return (
      <Card className="flex flex-col gap-3">
        <p className="px-1 text-sm font-semibold text-ink">{t("repeat.scopePrompt")}</p>
        <button
          type="button"
          onClick={() => setScope("this")}
          className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3.5 py-3 text-left text-sm font-semibold text-ink transition hover:bg-brand-soft active:scale-[0.99]"
        >
          <CalendarCheck2 aria-hidden className="size-5 shrink-0 text-brand" />
          {t("repeat.scopeThis")}
        </button>
        <button
          type="button"
          onClick={() => setScope("all")}
          className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3.5 py-3 text-left text-sm font-semibold text-ink transition hover:bg-brand-soft active:scale-[0.99]"
        >
          <CalendarRange aria-hidden className="size-5 shrink-0 text-brand" />
          {t("repeat.scopeAll")}
        </button>
      </Card>
    );
  }

  return (
    <EventForm
      mode="edit"
      event={scope === "this" ? occurrenceEvent : event}
      connections={connections}
      scope={scope}
      occurrenceDate={scope === "this" ? occurrenceDate : undefined}
      returnView={returnView}
    />
  );
}
