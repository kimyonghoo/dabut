import { render, screen, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TimezoneProvider, useTimezone } from "./timezone-provider";

function Probe() {
  const { timeZone, setTimeZone } = useTimezone();
  return <button onClick={() => setTimeZone("America/New_York")}>{timeZone}</button>;
}

describe("TimezoneProvider", () => {
  it("seeds the context value from initialTimeZone", () => {
    render(
      <TimezoneProvider initialTimeZone="Asia/Seoul">
        <Probe />
      </TimezoneProvider>
    );
    expect(screen.getByRole("button")).toHaveTextContent("Asia/Seoul");
  });

  it("falls back to the default timezone when initialTimeZone is empty", () => {
    render(
      <TimezoneProvider initialTimeZone="">
        <Probe />
      </TimezoneProvider>
    );
    expect(screen.getByRole("button")).toHaveTextContent("Asia/Seoul");
  });

  it("updates the context value when setTimeZone is called", () => {
    render(
      <TimezoneProvider initialTimeZone="Asia/Seoul">
        <Probe />
      </TimezoneProvider>
    );
    act(() => screen.getByRole("button").click());
    expect(screen.getByRole("button")).toHaveTextContent("America/New_York");
  });

  it("throws when useTimezone is called outside a TimezoneProvider", () => {
    function Bare() {
      useTimezone();
      return null;
    }
    expect(() => render(<Bare />)).toThrow("useTimezone must be used within a TimezoneProvider");
  });
});
