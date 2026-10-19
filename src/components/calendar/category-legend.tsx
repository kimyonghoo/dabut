import { useTranslations } from "next-intl";
import { CATEGORY_KEY, DOT_CLASSNAME, type EventCategory } from "./category-style";

const ORDER: EventCategory[] = ["mine", "partner", "shared"];

export function CategoryLegend({ partnerName }: { partnerName?: string | null }) {
  const t = useTranslations("calendar");

  // Prefer the partner's real nickname over the generic "상대방 일정" label
  // when we have one — same precedent as ThreadList's categoryLabel and the
  // ledger's OwnershipLegend — instead of re-fetching it here.
  function label(category: EventCategory): string {
    if (category === "partner" && partnerName) return t("categoryPartnerNamed", { name: partnerName });
    return t(CATEGORY_KEY[category]);
  }

  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-ink-muted">
      {ORDER.map((category) => (
        <li key={category} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${DOT_CLASSNAME[category]}`} />
          {label(category)}
        </li>
      ))}
    </ul>
  );
}
