"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * 3개월을 세로 스크롤로 보여주는 컨테이너. 스크롤하면 페이지 전체가 아니라 월 달력 단위로
 * 자석처럼 화면 중앙에 맞춰진다 (CSS scroll-snap).
 */
export function MonthScroller({ children, initialIndex = 0 }: { children: ReactNode; initialIndex?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  // 선택한 월이 화면 가운데에 오도록 처음 위치를 맞춘다 (위에는 이전 달이 보인다).
  useLayoutEffect(() => {
    const el = ref.current;
    const target = el?.children[initialIndex] as HTMLElement | undefined;
    if (!el || !target) return;
    el.style.scrollBehavior = "auto";
    el.scrollTop = target.offsetTop - (el.clientHeight - target.offsetHeight) / 2;
    el.style.scrollBehavior = "";
  }, [initialIndex]);

  return (
    <div
      ref={ref}
      className="relative -mx-1 h-[calc(100dvh-12.5rem)] snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
