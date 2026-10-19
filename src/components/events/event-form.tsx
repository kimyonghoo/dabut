"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays, HeartHandshake, MapPin, Repeat, Trash2, User, Users, type LucideIcon } from "lucide-react";
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
import type { RecurrenceFreq } from "@/lib/events/recurrence";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type TimeMode = "allDay" | "timeRange" | "dateRange";
type RecurrenceFreqChoice = "none" | RecurrenceFreq | "custom";
type RecurrenceEndChoice = "never" | "until" | "count";

/**
 * A plain preset (매일/매주/매월/매년) and "사용자 설정" with interval 1 store
 * identical recurrence_* values — on edit, an interval-1 series round-trips
 * to its plain preset rather than "custom", which is harmless (same
 * behavior either way) and keeps the common case showing the simpler choice.
 */
function computeInitialFreqChoice(event: EventRow | undefined): RecurrenceFreqChoice {
  if (!event?.recurrence_freq) return "none";
  return event.recurrence_interval === 1 ? (event.recurrence_freq as RecurrenceFreq) : "custom";
}

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
  scope = "all",
  occurrenceDate,
}: {
  mode: "create" | "edit";
  event?: EventRow;
  connections: Array<{ id: string; partnerEmail: string }>;
  /** yyyy-MM-dd to prefill the start date when creating. */
  defaultDate?: string;
  /**
   * For editing a recurring event: "all" edits the series' parent row
   * directly (recurrence rule included); "this" detaches just the tapped
   * occurrence into its own standalone event (see occurrenceDate below) and
   * never shows the 반복 section — a single detached occurrence can't itself
   * be recurring. Irrelevant for `mode: "create"` (always "all").
   */
  scope?: "this" | "all";
  /** Required alongside `scope: "this"` — the occurrence's original calendar date (yyyy-MM-dd, parent's timezone), used to key its exception. */
  occurrenceDate?: string;
}) {
  const t = useTranslations("events");
  const { timeZone } = useTimezone();
  // The generic "+ 일정 추가" entry point passes no defaultDate (unlike the
  // day-summary sheet's "이날 일정 추가", which already passes a specific
  // date) — default that case to zoned-today rather than leaving the date
  // input empty.
  const zonedToday = toZonedDateInputValue(new Date().toISOString(), timeZone);
  const initialDate = defaultDate ?? zonedToday;
  const recurrenceEditable = mode === "create" || scope === "all";
  const action =
    mode === "create" ? createEvent : updateEvent.bind(null, event!.id, scope, occurrenceDate ?? null);
  const [state, formAction] = useActionState<EventActionState, FormData>(action, {});
  const [timeMode, setTimeMode] = useState<TimeMode>(computeInitialTimeMode(event, timeZone));
  const [shared, setShared] = useState(event?.visibility === "shared");
  const [freqChoice, setFreqChoice] = useState<RecurrenceFreqChoice>(computeInitialFreqChoice(event));
  const [customUnit, setCustomUnit] = useState<RecurrenceFreq>(
    event?.recurrence_freq && event.recurrence_interval !== 1 ? (event.recurrence_freq as RecurrenceFreq) : "daily"
  );
  const [recurrenceInterval, setRecurrenceInterval] = useState(event?.recurrence_interval ?? 2);
  const [endChoice, setEndChoice] = useState<RecurrenceEndChoice>(
    (event?.recurrence_end_type as RecurrenceEndChoice | null) ?? "never"
  );
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
        const result = await deleteEvent(event!.id, scope, occurrenceDate ?? null);
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

  const freqOptions: Array<{ value: RecurrenceFreqChoice; label: string }> = [
    { value: "none", label: t("repeat.none") },
    { value: "daily", label: t("repeat.daily") },
    { value: "weekly", label: t("repeat.weekly") },
    { value: "monthly", label: t("repeat.monthly") },
    { value: "yearly", label: t("repeat.yearly") },
    { value: "custom", label: t("repeat.custom") },
  ];
  const endOptions: Array<{ value: RecurrenceEndChoice; label: string }> = [
    { value: "never", label: t("repeat.endNever") },
    { value: "until", label: t("repeat.endUntil") },
    { value: "count", label: t("repeat.endCount") },
  ];
  const customUnitOptions: Array<{ value: RecurrenceFreq; label: string }> = [
    { value: "daily", label: t("repeat.unitDaily") },
    { value: "weekly", label: t("repeat.unitWeekly") },
    { value: "monthly", label: t("repeat.unitMonthly") },
    { value: "yearly", label: t("repeat.unitYearly") },
  ];

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
            defaultValue={event ? toZonedDateInputValue(event.start_at, timeZone) : initialDate}
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
                event ? toZonedDateInputValue(event.end_at ?? event.start_at, timeZone) : initialDate
              }
              required
              className={inputClass}
            />
          )}
        </div>
        {timeMode === "timeRange" && (
          <div className="grid grid-cols-2 gap-2">
            <input
              type="time"
              name="startTime"
              defaultValue={event ? toZonedTimeInputValue(event.start_at, timeZone) : undefined}
              required
              className={inputClass}
            />
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

      {recurrenceEditable && (
        <Card className="flex flex-col gap-3">
          <SectionTitle icon={Repeat}>{t("repeat.label")}</SectionTitle>

          <fieldset className="grid grid-cols-3 gap-1 rounded-full bg-surface-2 p-1">
            {freqOptions.map((o) => (
              <label
                key={o.value}
                className="cursor-pointer rounded-full px-2 py-2 text-center text-xs font-semibold text-ink-muted transition has-[:checked]:bg-brand has-[:checked]:text-white has-[:checked]:shadow-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-soft"
              >
                <input
                  type="radio"
                  name="recurrenceFreq"
                  value={o.value}
                  checked={freqChoice === o.value}
                  onChange={() => setFreqChoice(o.value)}
                  className="sr-only"
                />
                {o.label}
              </label>
            ))}
          </fieldset>

          {freqChoice === "custom" && (
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <span className="shrink-0">{t("repeat.every")}</span>
              <input
                type="number"
                name="recurrenceInterval"
                min={1}
                value={recurrenceInterval}
                onChange={(e) => setRecurrenceInterval(Math.max(1, Number(e.target.value) || 1))}
                className={`${inputClass} w-16 text-center`}
              />
              <select
                name="recurrenceCustomUnit"
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value as RecurrenceFreq)}
                className={`${inputClass} flex-1`}
              >
                {customUnitOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {freqChoice !== "none" && (
            <>
              <SectionTitle>{t("repeat.endsLabel")}</SectionTitle>
              <fieldset className="grid grid-cols-3 gap-1 rounded-full bg-surface-2 p-1">
                {endOptions.map((o) => (
                  <label
                    key={o.value}
                    className="cursor-pointer rounded-full px-2 py-2 text-center text-xs font-semibold text-ink-muted transition has-[:checked]:bg-brand has-[:checked]:text-white has-[:checked]:shadow-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-soft"
                  >
                    <input
                      type="radio"
                      name="recurrenceEndType"
                      value={o.value}
                      checked={endChoice === o.value}
                      onChange={() => setEndChoice(o.value)}
                      className="sr-only"
                    />
                    {o.label}
                  </label>
                ))}
              </fieldset>

              {endChoice === "until" && (
                <input
                  type="date"
                  name="recurrenceUntil"
                  defaultValue={event?.recurrence_until ?? undefined}
                  required
                  className={inputClass}
                />
              )}
              {endChoice === "count" && (
                <div className="flex items-center gap-2 text-sm font-medium text-ink">
                  <input
                    type="number"
                    name="recurrenceCount"
                    min={1}
                    defaultValue={event?.recurrence_count ?? 5}
                    required
                    className={`${inputClass} w-20 text-center`}
                  />
                  <span>{t("repeat.countSuffix")}</span>
                </div>
              )}
            </>
          )}
        </Card>
      )}

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

function SectionTitle({ icon: Icon, children }: { icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-sm font-bold text-ink">
      {Icon && <Icon aria-hidden className="size-4 text-brand" />}
      {children}
    </span>
  );
}
