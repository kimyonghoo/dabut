import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { TransactionForm } from "./transaction-form";
import { TimezoneProvider } from "@/components/dates/timezone-provider";
import ko from "../../../messages/ko.json";

// next-intl's <Link> pulls in next/navigation internals that don't resolve
// cleanly under vitest/jsdom; this file's assertions don't touch links.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: unknown; children?: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/actions/transactions", () => ({
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
}));

const messages = { ledger: ko.ledger };

function renderWithIntl(timeZone: string) {
  return render(
    <NextIntlClientProvider locale="ko" messages={messages}>
      <TimezoneProvider initialTimeZone={timeZone}>
        <TransactionForm mode="create" categories={[]} />
      </TimezoneProvider>
    </NextIntlClientProvider>
  );
}

describe("TransactionForm create mode — zoned-today default", () => {
  // 08:00 KST on the 19th is still 23:00 UTC on the 18th — a regression test
  // for the bug where a new transaction's default occurredAt was computed
  // from `new Date().toISOString()` (UTC-today) instead of the user's
  // configured timezone.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-18T23:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults occurredAt to zoned-today (Asia/Seoul), not UTC-today", () => {
    renderWithIntl("Asia/Seoul");
    expect(screen.getByLabelText("날짜")).toHaveValue("2026-10-19");
  });

  it("defaults occurredAt to UTC-today when the user's timezone is UTC", () => {
    renderWithIntl("UTC");
    expect(screen.getByLabelText("날짜")).toHaveValue("2026-10-18");
  });
});
