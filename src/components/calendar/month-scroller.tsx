"use client";

import type { ReactNode } from "react";

/**
 * 3개월을 세로 스크롤로 보여주는 컨테이너. 스크롤하면 페이지 전체가 아니라 월 달력 단위로
 * 자석처럼 화면 중앙에 맞춰진다 (CSS scroll-snap).
 */
export function MonthScroller({ children }: { children: ReactNode }) {
  return (
    <div
      className="-mx-1 h-[calc(100dvh-12.5rem)] snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ scrollPaddingBlock: "0.25rem" }}
    >
      {children}
    </div>
  );
}

export function MonthSnapItem({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="flex min-h-full snap-center snap-always flex-col justify-center gap-2 py-1">
      <h2 className="px-1 text-sm font-extrabold text-ink">{title}</h2>
      {children}
    </section>
  );
}
