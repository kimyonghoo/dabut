/** 저장 직후 화면 중앙 효과: 레이아웃에 상주하는 <SaveCelebration />이 이벤트를 받아 보여준다. */
export const CELEBRATE_EVENT = "dabut:celebrate";

export type CelebrateDetail = { name: string; icon: string | null; amount: number };

export function showCelebration(detail: CelebrateDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CelebrateDetail>(CELEBRATE_EVENT, { detail }));
}
