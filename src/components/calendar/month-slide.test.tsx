import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MonthSlide } from "./month-slide";

describe("MonthSlide", () => {
  it("renders its children for the initial month", () => {
    render(
      <MonthSlide monthKey="2026-10">
        <div>October content</div>
      </MonthSlide>
    );

    expect(screen.getByText("October content")).toBeInTheDocument();
  });

  it("swaps in the new month's content without throwing when monthKey advances", () => {
    const { rerender } = render(
      <MonthSlide monthKey="2026-10">
        <div>October content</div>
      </MonthSlide>
    );

    rerender(
      <MonthSlide monthKey="2026-11">
        <div>November content</div>
      </MonthSlide>
    );

    expect(screen.getByText("November content")).toBeInTheDocument();
  });

  it("swaps in the new month's content without throwing when monthKey goes backward", () => {
    const { rerender } = render(
      <MonthSlide monthKey="2026-10">
        <div>October content</div>
      </MonthSlide>
    );

    rerender(
      <MonthSlide monthKey="2026-09">
        <div>September content</div>
      </MonthSlide>
    );

    expect(screen.getByText("September content")).toBeInTheDocument();
  });

  it("tolerates repeated month changes in sequence (simulating successive swipes)", () => {
    const { rerender } = render(
      <MonthSlide monthKey="2026-10">
        <div>October content</div>
      </MonthSlide>
    );

    rerender(
      <MonthSlide monthKey="2026-11">
        <div>November content</div>
      </MonthSlide>
    );
    rerender(
      <MonthSlide monthKey="2026-12">
        <div>December content</div>
      </MonthSlide>
    );

    expect(screen.getByText("December content")).toBeInTheDocument();
  });
});
