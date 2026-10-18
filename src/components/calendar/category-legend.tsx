import { useTranslations } from "next-intl";
import { CATEGORY_KEY, DOT_CLASSNAME, type EventCategory } from "./category-style";

const ORDER: EventCategory[] = ["mine", "partner", "shared"];

export function CategoryLegend() {
  const t = useTranslations("calendar");
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-ink-muted">
      {ORDER.map((category) => (
        <li key={category} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${DOT_CLASSNAME[category]}`} />
          {t(CATEGORY_KEY[category])}
        </li>
      ))}
    </ul>
  );
}
