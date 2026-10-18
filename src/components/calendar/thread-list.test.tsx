import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { ThreadList, type ThreadGroup } from "./thread-list";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: unknown; children?: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/actions/swipe-delete", () => ({
  quickDeleteEvent: vi.fn(),
}));

const messages = {
  calendar: {
    categoryMine: "My events",
    categoryPartner: "Partner's events",
    categoryPartnerNamed: "{name}'s events",
    categoryShared: "Shared events",
  },
  dates: { today: "Today", yesterday: "Yesterday", tomorrow: "Tomorrow" },
  common: { delete: "Delete" },
};

function makeGroups(category: "mine" | "partner" | "shared"): ThreadGroup[] {
  return [
    {
      date: "2026-10-18",
      events: [
        {
          id: "e1",
          ownerId: "partner",
          title: "Dinner",
          location: null,
          companions: null,
          category,
          timeText: "19:00",
        },
      ],
    },
  ];
}

function renderList(groups: ThreadGroup[], partnerName?: string | null) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ThreadList groups={groups} currentUserId="me" serverTodayKey="2026-10-18" partnerName={partnerName} />
    </NextIntlClientProvider>
  );
}

describe("ThreadList partner label", () => {
  it("shows the partner's nickname instead of the generic label when available", () => {
    renderList(makeGroups("partner"), "Minji");
    expect(screen.getByText("Minji's events")).toBeInTheDocument();
    expect(screen.queryByText("Partner's events")).not.toBeInTheDocument();
  });

  it("falls back to the generic partner label when there's no nickname", () => {
    renderList(makeGroups("partner"), null);
    expect(screen.getByText("Partner's events")).toBeInTheDocument();
  });

  it("does not use the nickname for the viewer's own or shared events", () => {
    renderList(makeGroups("mine"), "Minji");
    expect(screen.getByText("My events")).toBeInTheDocument();

    renderList(makeGroups("shared"), "Minji");
    expect(screen.getByText("Shared events")).toBeInTheDocument();
  });
});
