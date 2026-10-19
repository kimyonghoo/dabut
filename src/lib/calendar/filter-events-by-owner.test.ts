import { describe, it, expect } from "vitest";
import { filterEventsByOwner } from "./filter-events-by-owner";

describe("filterEventsByOwner", () => {
  const events = [
    { id: "a", category: "mine" as const },
    { id: "b", category: "partner" as const },
    { id: "c", category: "shared" as const },
  ];

  it("returns every event when the filter is null (전체)", () => {
    expect(filterEventsByOwner(events, null).map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps 'mine' events and shared events under the 'mine' filter", () => {
    expect(filterEventsByOwner(events, "mine").map((e) => e.id)).toEqual(["a", "c"]);
  });

  it("keeps 'partner' events and shared events under the 'partner' filter", () => {
    expect(filterEventsByOwner(events, "partner").map((e) => e.id)).toEqual(["b", "c"]);
  });
});
