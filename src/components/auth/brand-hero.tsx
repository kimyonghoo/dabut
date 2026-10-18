import { useTranslations } from "next-intl";

/** Two snuggled hearts — brand + partner color — "다붓하다". */
export function LogoMark({ size = 72 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      aria-hidden="true"
      className="drop-shadow-[0_6px_14px_rgba(255,111,97,0.25)]"
    >
      <rect x="2" y="2" width="76" height="76" rx="24" className="fill-surface" />
      <g transform="translate(30 44) rotate(-12)">
        <path
          d="M0 14 C-14 4 -16 -6 -10 -11 C-5 -15 0 -12 0 -7 C0 -12 5 -15 10 -11 C16 -6 14 4 0 14 Z"
          className="fill-partner"
        />
      </g>
      <g transform="translate(48 40) rotate(12)">
        <path
          d="M0 15 C-15 4 -17 -6 -11 -12 C-5 -16 0 -13 0 -8 C0 -13 5 -16 11 -12 C17 -6 15 4 0 15 Z"
          className="fill-brand"
          opacity="0.92"
        />
        <ellipse cx="-5.5" cy="-7" rx="2.6" ry="1.6" fill="white" opacity="0.7" transform="rotate(-30 -5.5 -7)" />
      </g>
    </svg>
  );
}

export function BrandHero() {
  const t = useTranslations("app");
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <LogoMark />
      <div>
        <p className="text-3xl font-extrabold tracking-tight text-ink">{t("name")}</p>
        <p className="mt-1 text-sm text-ink-muted">{t("tagline")}</p>
      </div>
    </div>
  );
}
