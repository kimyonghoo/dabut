import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MonthNavArrows } from "./month-nav-arrows";

const push = vi.fn();

// MonthNavArrows navigates via useProgressRouter -> useRouter from this
// module (same mocking approach as month-view.test.tsx); no assertion here
// touches real routing, just that the right href is pushed.
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

describe("MonthNavArrows", () => {
  it("pushes the next month's href when the next arrow is clicked", () => {
    push.mockClear();
    render(
      <MonthNavArrows month={new Date(2026, 9, 1)} monthTitle="2026년 10월" prevLabel="이전 달" nextLabel="다음 달" />
    );

    fireEvent.click(screen.getByLabelText("다음 달"));

    expect(push).toHaveBeenCalledWith({ pathname: "/calendar", query: { month: "2026-11" } });
  });

  it("pushes the previous month's href when the prev arrow is clicked", () => {
    push.mockClear();
    render(
      <MonthNavArrows month={new Date(2026, 9, 1)} monthTitle="2026년 10월" prevLabel="이전 달" nextLabel="다음 달" />
    );

    fireEvent.click(screen.getByLabelText("이전 달"));

    expect(push).toHaveBeenCalledWith({ pathname: "/calendar", query: { month: "2026-09" } });
  });

  it("renders the month title between the two arrows", () => {
    render(
      <MonthNavArrows month={new Date(2026, 9, 1)} monthTitle="2026년 10월" prevLabel="이전 달" nextLabel="다음 달" />
    );

    expect(screen.getByText("2026년 10월")).toBeInTheDocument();
  });
});
