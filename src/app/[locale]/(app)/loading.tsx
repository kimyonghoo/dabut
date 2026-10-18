import { getTranslations } from "next-intl/server";
import { HeartLoader } from "@/components/feedback/heart-loader";

export default async function Loading() {
  const t = await getTranslations("common");
  return <HeartLoader label={t("loading")} />;
}
