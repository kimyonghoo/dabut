import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { TimezoneProvider } from "@/components/dates/timezone-provider";
import { MonthView } from "@/components/calendar/month-view";
import type { Database } from "@/types/database.types";
import ko from "../../../messages/ko.json";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type CategorizedEvent = EventRow & { category: "mine" | "partner" | "shared" };

// next-intl's <Link> (re-exported from "@/i18n/navigation") pulls in
// next/navigation internals that don't resolve cleanly under vitest/jsdom;
// none of this file's assertions touch links, so a plain <a> stand-in is enough.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: unknown; children?: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children}
    </a>
  ),
  // MonthView's swipe-to-change-month gesture pulls in useProgressRouter ->
  // useRouter from this module on every render (not just during a drag);
  // none of this file's assertions exercise navigation, so a no-op stub is enough.
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const messages = { calendar: ko.calendar, daySummary: ko.daySummary };

function makeEvent(overrides: Partial<CategorizedEvent> & { id: string; start_at: string }): CategorizedEvent {
  return {
    owner_id: "me",
    created_by: "me",
    connection_id: "conn-1",
    visibility: "personal",
    title: overrides.id,
    location: null,
    companions: null,
    all_day: false,
    end_at: null,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
    category: "mine",
    ...overrides,
  } as CategorizedEvent;
}

function renderMonth(events: CategorizedEvent[], { monthViewTimeZone, contextTimeZone }: { monthViewTimeZone: string; contextTimeZone: string }) {
  const month = new Date(2026, 9, 1);
  return render(
    <NextIntlClientProvider locale="ko" messages={messages}>
      <TimezoneProvider initialTimeZone={contextTimeZone}>
        <MonthView
          month={month}
          events={events}
          currentUserId="me"
          partnerName="파트너"
          timeZone={monthViewTimeZone}
        />
      </TimezoneProvider>
    </NextIntlClientProvider>
  );
}

describe("MonthView day-summary data threading", () => {
  // Regression test for the day-summary sheet showing an empty "partner"
  // section (or any section) that actually has events for that day: this
  // exercises the real prop-threading path (page -> MonthView ->
  // DaySummaryProvider -> DaySummarySheet -> splitDayEvents), not just
  // splitDayEvents in isolation.
  it("shows both the viewer's and the partner's events for the tapped day", () => {
    const events = [
      makeEvent({ id: "mine-event", owner_id: "me", start_at: "2026-10-18T09:00:00.000Z" }),
      makeEvent({ id: "partner-event", owner_id: "partner", start_at: "2026-10-18T10:00:00.000Z" }),
    ];
    renderMonth(events, { monthViewTimeZone: "UTC", contextTimeZone: "UTC" });

    fireEvent.click(screen.getByLabelText(/10월 18일/));

    // Each appears once as a grid chip and once as a row inside the sheet.
    expect(screen.getAllByText("mine-event")).toHaveLength(2);
    expect(screen.getAllByText("partner-event")).toHaveLength(2);
  });

  // The sheet must use the SAME timezone the page/MonthView resolved for
  // this render (threaded in as the `timeZone` prop), not a separately
  // seeded `useTimezone()` context value — that context is set once when
  // the (app) layout mounts and doesn't re-sync on client-side navigation,
  // so it can drift from the fresh per-request value. An event near
  // midnight lands on a different calendar day depending on which zone is
  // used, so a divergence here silently empties a day's events in the
  // sheet while the month grid (which always reads the prop) still shows it.
  it("uses the timeZone prop threaded from MonthView, not a stale timezone-context value, to decide a day's events", () => {
    // 2026-10-17T16:00:00Z is Oct 17 in UTC but Oct 18 01:00 in Asia/Seoul.
    const events = [makeEvent({ id: "midnight-event", owner_id: "partner", start_at: "2026-10-17T16:00:00.000Z" })];
    renderMonth(events, { monthViewTimeZone: "Asia/Seoul", contextTimeZone: "UTC" });

    // The grid chip (always driven by the `timeZone` prop) places it on Oct 18.
    expect(screen.getByText("midnight-event")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/10월 18일/));

    // The sheet must agree with the grid: same event, same prop-driven zone.
    expect(screen.getAllByText("midnight-event")).toHaveLength(2);
  });
});

describe("MonthView multi-day events", () => {
  // A Sat Oct 3 -> Sun Oct 4 span crosses a week boundary in October 2026's
  // grid, so it exercises the two-segment (week-wrapped) bar case, not just
  // a single-week bar.
  const multiDayEvent = makeEvent({
    id: "trip",
    owner_id: "me",
    start_at: "2026-10-03T09:00:00.000Z",
    end_at: "2026-10-04T18:00:00.000Z",
  });

  it("renders a spanning event once as a bar, not once per day cell", () => {
    renderMonth([multiDayEvent], { monthViewTimeZone: "UTC", contextTimeZone: "UTC" });
    // The title is only drawn on the segment containing the event's true
    // start day, so it should appear exactly once in the grid (no sheet open yet).
    expect(screen.getAllByText("trip")).toHaveLength(1);
  });

  it("shows the full date range (not just that day) when either end day is tapped", () => {
    renderMonth([multiDayEvent], { monthViewTimeZone: "UTC", contextTimeZone: "UTC" });

    fireEvent.click(screen.getByLabelText(/10월 3일/));
    expect(screen.getByText("10월 3일 오전 9:00 ~ 10월 4일 오후 6:00")).toBeInTheDocument();
  });

  it("shows the same full date range when tapping the *other* end day of the span", () => {
    renderMonth([multiDayEvent], { monthViewTimeZone: "UTC", contextTimeZone: "UTC" });

    fireEvent.click(screen.getByLabelText(/10월 4일/));
    expect(screen.getByText("10월 3일 오전 9:00 ~ 10월 4일 오후 6:00")).toBeInTheDocument();
  });

  it("does not show a date-range row for an ordinary same-day event", () => {
    const sameDay = makeEvent({ id: "lunch", owner_id: "me", start_at: "2026-10-18T09:00:00.000Z" });
    renderMonth([sameDay], { monthViewTimeZone: "UTC", contextTimeZone: "UTC" });

    fireEvent.click(screen.getByLabelText(/10월 18일/));
    expect(screen.queryByText(/~/)).not.toBeInTheDocument();
  });
});
