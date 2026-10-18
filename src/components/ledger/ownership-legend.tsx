import { useTranslations } from "next-intl";
import { DOT_CLASSNAME } from "./ownership-style";

export function OwnershipLegend({ partnerName }: { partnerName?: string | null }) {
  const t = useTranslations("ledger");
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-ink-muted">
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${DOT_CLASSNAME.mine}`} />
        {t("legendMine")}
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${DOT_CLASSNAME.partner}`} />
        {partnerName ? t("legendPartnerNamed", { name: partnerName }) : t("legendPartner")}
      </li>
    </ul>
  );
}
