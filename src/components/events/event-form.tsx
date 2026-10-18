"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays, HeartHandshake, MapPin, Trash2, User, Users, type LucideIcon } from "lucide-react";
import { createEvent, updateEvent, deleteEvent, type EventActionState } from "@/lib/actions/events";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { SubmitButton, Spinner } from "@/components/ui/submit-button";
import { doneProgress, startProgress } from "@/components/feedback/progress-store";
import { Card } from "@/components/ui/card";
import { inputClass, labelClass, errorClass } from "@/components/ui/field";
import { CompanionPicker } from "@/components/events/companion-picker";
import { useTimezone } from "@/components/dates/timezone-provider";
import { toZonedDateInputValue, toZonedTimeInputValue } from "@/lib/dates/timezone";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type TimeMode = "allDay" | "timeRange" | "dateRange";

function computeInitialTimeMode(event: EventRow | undefined, timeZone: string): TimeMode {
  if (!event) return "timeRange";
  if (!event.all_day) return "timeRange";
  if (!event.end_at) return "allDay";
  return toZonedDateInputValue(event.start_at, timeZone) === toZonedDateInputValue(event.end_at, timeZone)
    ? "allDay"
    : "dateRange";
}

export function EventForm({
  mode,
  event,
  connections,
  defaultDate,
}: {
  mode: "create" | "edit";
  event?: EventRow;
  connections: Array<{ id: string; partnerEmail: string }>;
  /** yyyy-MM-dd to prefill the start date when creating. */
  defaultDate?: string;
}) {
  const t = useTranslations("events");
  const { timeZone } = useTimezone();
  const action = mode === "create" ? createEvent : updateEvent.bind(null, event!.id);
  const [state, formAction] = useActionState<EventActionState, FormData>(action, {});
  const [timeMode, setTimeMode] = useState<TimeMode>(computeInitialTimeMode(event, timeZone));
  const [shared, setShared] = useState(event?.visibility === "shared");
  const [deleting, startDelete] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();

  // The confirm state reverts after 3s if the second tap never comes.
  useEffect(() => {
    if (!confirmingDelete) return;
    const timer = setTimeout(() => setConfirmingDelete(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmingDelete]);

  function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setConfirmingDelete(false);
    setDeleteError(undefined);
    startDelete(async () => {
      startProgress();
      try {
        // On success the action redirects to the calendar; only errors return.
        const result = await deleteEvent(event!.id);
        if (result?.error) setDeleteError(result.error);
      } finally {
        doneProgress();
      }
    });
  }

  const modes: Array<{ value: TimeMode; label: string }> = [
    { value: "allDay", label: t("modeAllDay") },
    { value: "timeRange", label: t("modeTimeRange") },
    { value: "dateRange", label: t("modeDateRange") },
  ];
  const txt = (key: string, fallback: string) => (t.has(key) ? t(key) : fallback);

  return (
    <form action={formAction} className="flex flex-col gap-4 pb-24">
      <Card className="flex flex-col gap-3">
        <label className={labelClass}>
          {t("title")}
          <input
            type="text"
            name="title"
            defaultValue={event?.title}
            required
            className={`${inputClass} text-base font-semibold`}
          />
        </label>
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionTitle icon={CalendarDays}>{txt("when", "When")}</SectionTitle>

        <fieldset className="grid grid-cols-3 gap-1 rounded-full bg-surface-2 p-1">
          {modes.map((m) => (
            <label
              key={m.value}
              className="cursor-pointer rounded-full px-2 py-2 text-center text-xs font-semibold text-ink-muted transition has-[:checked]:bg-brand has-[:checked]:text-white has-[:checked]:shadow-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-soft"
            >
              <input
                type="radio"
                name="mode"
                value={m.value}
                checked={timeMode === m.value}
                onChange={() => setTimeMode(m.value)}
                className="sr-only"
              />
              {m.label}
            </label>
          ))}
        </fieldset>

        <div className={timeMode === "allDay" ? "" : "grid grid-cols-2 gap-2"}>
          <input
            type="date"
            name="startDate"
            defaultValue={event ? toZonedDateInputValue(event.start_at, timeZone) : defaultDate}
            required
            className={inputClass}
          />
          {timeMode === "dateRange" && (
            <input
              type="date"
              name="endDate"
              defaultValue={event?.end_at ? toZonedDateInputValue(event.end_at, timeZone) : undefined}
              required
              className={inputClass}
            />
          )}
          {/* A timed event can cross midnight (e.g. 11pm–1am), so it needs its
              own end date rather than reusing startDate. Defaults to the start
              date (the common same-day case) but stays editable. */}
          {timeMode === "timeRange" && (
            <input
              type="date"
              name="endDate"
              defaultValue={
                event ? toZonedDateInputValue(event.end_at ?? event.start_at, timeZone) : defaultDate
              }
              required
              className={inputClass}
            />
          )}
        </div>
        {timeMode === "timeRange" && (
          <div className="flex items-center gap-2">
            <input
              type="time"
              name="startTime"
              defaultValue={event ? toZonedTimeInputValue(event.start_at, timeZone) : undefined}
              required
              className={inputClass}
            />
            <span className="text-ink-muted" aria-hidden>
              ~
            </span>
            <input
              type="time"
              name="endTime"
              defaultValue={event?.end_at ? toZonedTimeInputValue(event.end_at, timeZone) : undefined}
              required
              className={inputClass}
            />
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <label className={labelClass}>
          <SectionTitle icon={MapPin}>{t("location")}</SectionTitle>
          <input
            type="text"
            name="location"
            defaultValue={event?.location ?? ""}
            className={inputClass}
          />
        </label>
      </Card>

      <Card className="flex flex-col gap-3">
        <div className={labelClass}>
          <SectionTitle icon={Users}>{t("companions")}</SectionTitle>
          <CompanionPicker name="companions" defaultValue={event?.companions} />
        </div>

        {connections.length === 0 ? (
          <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-sm text-ink-muted">
            {t("noConnection")}
          </p>
        ) : (
          <>
            <label
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-3.5 py-3 transition ${
                shared ? "bg-shared-soft" : "bg-surface-2"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                {shared ? (
                  <HeartHandshake aria-hidden className="size-4 text-brand" />
                ) : (
                  <User aria-hidden className="size-4 text-ink-muted" />
                )}
                {t("shared")}
              </span>
              <input
                type="checkbox"
                name="shared"
                checked={shared}
                onChange={(e) => setShared(e.target.checked)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className="relative h-7 w-12 shrink-0 rounded-full bg-line transition peer-checked:bg-shared peer-focus-visible:ring-2 peer-focus-visible:ring-shared-soft after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
              />
            </label>
            {shared && (
              <select
                name="connectionId"
                defaultValue={event?.connection_id ?? ""}
                required
                className={inputClass}
              >
                {connections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.partnerEmail}
                  </option>
                ))}
              </select>
            )}
          </>
        )}
      </Card>

      {(deleteError ?? state.error) && (
        <p role="alert" className={errorClass}>
          {deleteError ?? state.error}
        </p>
      )}

      {mode === "edit" && (
        <Button
          type="button"
          variant="danger"
          onClick={handleDelete}
          disabled={deleting}
          aria-busy={deleting}
          aria-live="polite"
        >
          {deleting ? <Spinner /> : <Trash2 aria-hidden className="size-4" />}
          {deleting
            ? txt("deleting", "Deleting…")
            : confirmingDelete
              ? txt("deleteConfirm", "Tap again to delete")
              : t("delete")}
        </Button>
      )}

      <div className="sticky bottom-24 z-10 -mx-1 mt-2 rounded-full bg-bg/80 p-1 backdrop-blur">
        <SubmitButton
          className="w-full py-3.5 text-base"
          pendingText={txt("saving", "Saving…")}
          disabled={deleting}
        >
          {t("save")}
        </SubmitButton>
      </div>
    </form>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-sm font-bold text-ink">
      <Icon aria-hidden className="size-4 text-brand" />
      {children}
    </span>
  );
}
