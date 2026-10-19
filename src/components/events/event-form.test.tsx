import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { EventForm } from "./event-form";
import { TimezoneProvider } from "@/components/dates/timezone-provider";
import type { Database } from "@/types/database.types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

vi.mock("@/lib/actions/events", () => ({
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
}));

const messages = {
  events: {
    title: "Title",
    location: "Where",
    companions: "Who with",
    companionOptions: {
      groupLabel: "Who's this with",
      spouse: "Spouse",
      child: "Child",
      friend: "Friend",
      parents: "Parents",
      siblings: "Siblings",
      colleague: "Colleague",
      other: "Other",
      otherPlaceholder: "e.g. Uncle Min-su",
    },
    modeAllDay: "All day",
    modeTimeRange: "Time range",
    modeDateRange: "Date range",
    shared: "Shared",
    noConnection: "No connection",
    save: "Save",
    delete: "Delete",
  },
};

function renderWithIntl(ui: React.ReactElement, timeZone = "UTC") {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {/* UTC keeps these prefill assertions a direct passthrough of the stored
          instant; timezone-specific conversion is covered in timezone.test.ts. */}
      <TimezoneProvider initialTimeZone={timeZone}>{ui}</TimezoneProvider>
    </NextIntlClientProvider>
  );
}

function makeEvent(overrides: Partial<EventRow>): EventRow {
  return {
    id: "e1",
    owner_id: "u1",
    created_by: "u1",
    connection_id: null,
    visibility: "personal",
    title: "Untitled",
    location: null,
    companions: null,
    all_day: true,
    start_at: "2026-10-15T00:00:00.000Z",
    end_at: null,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
    ...overrides,
  } as EventRow;
}

describe("EventForm edit mode", () => {
  it("prefills a dateRange event's start/end dates and selects the dateRange mode", () => {
    const event = makeEvent({
      title: "Trip",
      all_day: true,
      start_at: "2026-10-15T00:00:00.000Z",
      end_at: "2026-10-17T00:00:00.000Z",
    });
    renderWithIntl(<EventForm mode="edit" event={event} connections={[]} />);

    expect(screen.getByRole("radio", { name: "Date range" })).toBeChecked();
    expect(screen.getByDisplayValue("2026-10-15")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-10-17")).toBeInTheDocument();
  });

  it("prefills a timeRange event's start/end times", () => {
    const event = makeEvent({
      title: "Meeting",
      all_day: false,
      start_at: "2026-10-15T09:00:00.000Z",
      end_at: "2026-10-15T10:30:00.000Z",
    });
    renderWithIntl(<EventForm mode="edit" event={event} connections={[]} />);

    expect(screen.getByRole("radio", { name: "Time range" })).toBeChecked();
    expect(screen.getByDisplayValue("09:00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("10:30")).toBeInTheDocument();
  });

  it("prefills a midnight-crossing timeRange event's start/end dates and times", () => {
    const event = makeEvent({
      title: "Night out",
      all_day: false,
      start_at: "2026-10-15T23:00:00.000Z",
      end_at: "2026-10-16T01:00:00.000Z",
    });
    renderWithIntl(<EventForm mode="edit" event={event} connections={[]} />);

    expect(screen.getByRole("radio", { name: "Time range" })).toBeChecked();
    expect(screen.getByDisplayValue("2026-10-15")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-10-16")).toBeInTheDocument();
    expect(screen.getByDisplayValue("23:00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("01:00")).toBeInTheDocument();
  });

  it("selects allDay mode for a single-day all-day event", () => {
    const event = makeEvent({
      title: "Birthday",
      all_day: true,
      start_at: "2026-10-15T00:00:00.000Z",
      end_at: null,
    });
    renderWithIntl(<EventForm mode="edit" event={event} connections={[]} />);

    expect(screen.getByRole("radio", { name: "All day" })).toBeChecked();
    expect(screen.getByDisplayValue("2026-10-15")).toBeInTheDocument();
  });
});

describe("EventForm create mode", () => {
  // 08:00 KST on the 19th is still 23:00 UTC on the 18th — a regression test
  // for the bug where a brand-new event with no defaultDate (the generic
  // "+ 일정 추가" entry point) left the date input empty instead of
  // defaulting to the user's zoned-today.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-18T23:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults the start/end date inputs to zoned-today (not UTC-today) when no defaultDate is given", () => {
    renderWithIntl(<EventForm mode="create" connections={[]} />, "Asia/Seoul");

    // Default mode is "timeRange", which renders both a startDate and an
    // endDate input defaulting to the same zoned-today value.
    expect(screen.getAllByDisplayValue("2026-10-19")).toHaveLength(2);
  });

  it("still prefers an explicit defaultDate (from the day-summary sheet) over zoned-today", () => {
    renderWithIntl(<EventForm mode="create" connections={[]} defaultDate="2026-10-25" />, "Asia/Seoul");

    expect(screen.getAllByDisplayValue("2026-10-25")).toHaveLength(2);
  });
});
