export type EventCategory = "mine" | "partner" | "shared";

export const CATEGORY_KEY = {
  mine: "categoryMine",
  partner: "categoryPartner",
  shared: "categoryShared",
} as const satisfies Record<EventCategory, string>;

/** Compact chip used in month cells. */
export const CHIP_CLASSNAME: Record<EventCategory, string> = {
  mine: "bg-brand text-white",
  partner: "bg-partner-soft text-ink",
  shared: "bg-shared-soft text-ink",
};

/** Small badge used in thread cards. */
export const BADGE_CLASSNAME: Record<EventCategory, string> = {
  mine: "bg-brand-soft text-brand",
  partner: "bg-partner-soft text-ink",
  shared: "bg-shared-soft text-ink",
};

/** Solid dot / accent bar color. */
export const DOT_CLASSNAME: Record<EventCategory, string> = {
  mine: "bg-brand",
  partner: "bg-partner",
  shared: "bg-shared",
};
