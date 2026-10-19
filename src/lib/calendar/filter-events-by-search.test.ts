import { describe, it, expect } from "vitest";
import { filterEventsBySearch } from "./filter-events-by-search";

const events = [
  { id: "1", title: "Dinner with family" },
  { id: "2", title: "Dentist appointment" },
  { id: "3", title: "Movie night" },
];

describe("filterEventsBySearch", () => {
  it("returns everything for an empty or whitespace-only query", () => {
    expect(filterEventsBySearch(events, "")).toEqual(events);
    expect(filterEventsBySearch(events, "   ")).toEqual(events);
  });

  it("matches the title case-insensitively", () => {
    expect(filterEventsBySearch(events, "dinner").map((e) => e.id)).toEqual(["1"]);
    expect(filterEventsBySearch(events, "DENTIST").map((e) => e.id)).toEqual(["2"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterEventsBySearch(events, "zzz")).toEqual([]);
  });
});
