"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";

const BACK_HEART = "M0 14 C-14 4 -16 -6 -10 -11 C-5 -15 0 -12 0 -7 C0 -12 5 -15 10 -11 C16 -6 14 4 0 14 Z";
const BACK_TRANSFORM = "translate(30 44) rotate(-12)";
const FRONT_HEART = "M0 15 C-15 4 -17 -6 -11 -12 C-5 -16 0 -13 0 -8 C0 -13 5 -16 11 -12 C17 -6 15 4 0 15 Z";
const FRONT_TRANSFORM = "translate(48 40) rotate(12)";

/**
 * Two snuggled hearts, flat and single-tone each (brand coral + partner
 * blue) — the overlap is filled with the two colors' actual geometric
 * intersection (via clipPath), not a guessed blend, rendered in a dusty
 * plum that reads as "the two mixed together".
 */
export function LogoMark({ size = 72 }: { size?: number }) {
  const clipId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <path d={FRONT_HEART} transform={FRONT_TRANSFORM} />
        </clipPath>
      </defs>
      <path d={BACK_HEART} transform={BACK_TRANSFORM} fill="#7c93c9" />
      <path d={FRONT_HEART} transform={FRONT_TRANSFORM} fill="#ff8a65" />
      <g clipPath={`url(#${clipId})`}>
        <path d={BACK_HEART} transform={BACK_TRANSFORM} fill="#a9709e" />
      </g>
    </svg>
  );
}

/** Dark brand header for the (auth) pages — logo, name, one-line explainer. */
export function BrandHero() {
  const t = useTranslations("app");
  return (
    <div className="flex flex-col gap-3 bg-[#2c2320] px-6 pb-6 pt-9">
      <span aria-hidden="true" className="size-2 rounded-full bg-brand" />
      <div className="flex items-center gap-2.5">
        <LogoMark size={34} />
        <p className="text-[28px] font-extrabold leading-none tracking-tight text-[#fdf6f0]">{t("name")}</p>
      </div>
      <p className="text-[12.5px] text-[#b9a79c]">{t("tagline")}</p>
    </div>
  );
}
