"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { createEvent, updateEvent, deleteEvent, type EventActionState } from "@/lib/actions/events";
import type { Database } from "@/types/database.types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type TimeMode = "allDay" | "timeRange" | "dateRange";

function toDateInputValue(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toTimeInputValue(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mi}`;
}

function computeInitialTimeMode(event?: EventRow): TimeMode {
  if (!event) return "timeRange";
  if (!event.all_day) return "timeRange";
  if (!event.end_at) return "allDay";
  return toDateInputValue(event.start_at) === toDateInputValue(event.end_at) ? "allDay" : "dateRange";
}

export function EventForm({
  mode,
  event,
  connections,
}: {
  mode: "create" | "edit";
  event?: EventRow;
  connections: Array<{ id: string; partnerEmail: string }>;
}) {
  const t = useTranslations("events");
  const action = mode === "create" ? createEvent : updateEvent.bind(null, event!.id);
  const [state, formAction] = useActionState<EventActionState, FormData>(action, {});
  const [timeMode, setTimeMode] = useState<TimeMode>(computeInitialTimeMode(event));
  const [shared, setShared] = useState(event?.visibility === "shared");

  return (
    <form action={formAction}>
      <label>
        {t("title")}
        <input type="text" name="title" defaultValue={event?.title} required />
      </label>
      <label>
        {t("location")}
        <input type="text" name="location" defaultValue={event?.location ?? ""} />
      </label>
      <label>
        {t("companions")}
        <input type="text" name="companions" defaultValue={event?.companions ?? ""} />
      </label>

      <fieldset>
        <label>
          <input
            type="radio"
            name="mode"
            value="allDay"
            checked={timeMode === "allDay"}
            onChange={() => setTimeMode("allDay")}
          />
          {t("modeAllDay")}
        </label>
        <label>
          <input
            type="radio"
            name="mode"
            value="timeRange"
            checked={timeMode === "timeRange"}
            onChange={() => setTimeMode("timeRange")}
          />
          {t("modeTimeRange")}
        </label>
        <label>
          <input
            type="radio"
            name="mode"
            value="dateRange"
            checked={timeMode === "dateRange"}
            onChange={() => setTimeMode("dateRange")}
          />
          {t("modeDateRange")}
        </label>
      </fieldset>

      <input
        type="date"
        name="startDate"
        defaultValue={event ? toDateInputValue(event.start_at) : undefined}
        required
      />
      {timeMode === "timeRange" && (
        <>
          <input
            type="time"
            name="startTime"
            defaultValue={event ? toTimeInputValue(event.start_at) : undefined}
            required
          />
          <input
            type="time"
            name="endTime"
            defaultValue={event?.end_at ? toTimeInputValue(event.end_at) : undefined}
            required
          />
        </>
      )}
      {timeMode === "dateRange" && (
        <input
          type="date"
          name="endDate"
          defaultValue={event?.end_at ? toDateInputValue(event.end_at) : undefined}
          required
        />
      )}

      {connections.length === 0 ? (
        <p>{t("noConnection")}</p>
      ) : (
        <>
          <label>
            <input
              type="checkbox"
              name="shared"
              checked={shared}
              onChange={(e) => setShared(e.target.checked)}
            />
            {t("shared")}
          </label>
          {shared && (
            <select name="connectionId" defaultValue={event?.connection_id ?? ""} required>
              {connections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.partnerEmail}
                </option>
              ))}
            </select>
          )}
        </>
      )}

      {state.error && <p role="alert">{state.error}</p>}

      <button type="submit">{t("save")}</button>
      {mode === "edit" && (
        <button type="button" onClick={() => deleteEvent(event!.id)}>
          {t("delete")}
        </button>
      )}
    </form>
  );
}
