"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { createEvent, updateEvent, deleteEvent, type EventActionState } from "@/lib/actions/events";
import type { Database } from "@/types/database.types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type TimeMode = "allDay" | "timeRange" | "dateRange";

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
  const [timeMode, setTimeMode] = useState<TimeMode>(event?.all_day ? "allDay" : "timeRange");
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

      <input type="date" name="startDate" required />
      {timeMode === "timeRange" && (
        <>
          <input type="time" name="startTime" required />
          <input type="time" name="endTime" required />
        </>
      )}
      {timeMode === "dateRange" && <input type="date" name="endDate" required />}

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
