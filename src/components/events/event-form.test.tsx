import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { EventForm } from "./event-form";
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

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
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
