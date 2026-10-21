import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { MonthNavArrows } from "./month-nav-arrows";
import ko from "../../../messages/ko.json";

const push = vi.fn();

// MonthNavArrows navigates via useProgressRouter -> useRouter from this
// module (same mocking approach as month-view.test.tsx); no assertion here
// touches real routing, just that the right href is pushed.
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

const messages = { monthPicker: ko.monthPicker };

function renderNav(props: { month: Date; monthTitle: string }) {
  return render(
    <NextIntlClientProvider locale="ko" messages={messages}>
      <MonthNavArrows {...props} prevLabel="이전 달" nextLabel="다음 달" />
    </NextIntlClientProvider>
  );
}

describe("MonthNavArrows", () => {
  it("pushes the next month's href when the next arrow is clicked", () => {
    push.mockClear();
    renderNav({ month: new Date(2026, 9, 1), monthTitle: "2026년 10월" });

    fireEvent.click(screen.getByLabelText("다음 달"));

    expect(push).toHaveBeenCalledWith({ pathname: "/calendar", query: { month: "2026-11" } });
  });

  it("pushes the previous month's href when the prev arrow is clicked", () => {
    push.mockClear();
    renderNav({ month: new Date(2026, 9, 1), monthTitle: "2026년 10월" });

    fireEvent.click(screen.getByLabelText("이전 달"));

    expect(push).toHaveBeenCalledWith({ pathname: "/calendar", query: { month: "2026-09" } });
  });

  it("renders the month title between the two arrows", () => {
    renderNav({ month: new Date(2026, 9, 1), monthTitle: "2026년 10월" });

    expect(screen.getByText("2026년 10월")).toBeInTheDocument();
  });
});
