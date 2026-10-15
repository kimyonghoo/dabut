export type EventCategory = "mine" | "partner" | "shared";

export function categorizeEvent(
  event: { owner_id: string; visibility: "personal" | "shared" },
  currentUserId: string
): EventCategory {
  if (event.visibility === "shared") return "shared";
  return event.owner_id === currentUserId ? "mine" : "partner";
}
