/**
 * 저장 직후 화면 중앙 효과: 레이아웃에 상주하는 <SaveCelebration />이 이벤트를 받아 보여준다.
 * start 는 저장 버튼을 누른 즉시(로딩 화면 대신), finish 는 이동이 끝난 뒤, cancel 은 실패 시.
 */
export const CELEBRATE_EVENT = "dabut:celebrate";

export type CelebrateDetail = { name: string; icon: string | null; amount: number };
export type CelebrateMessage =
  | { kind: "start"; detail: CelebrateDetail }
  | { kind: "finish" }
  | { kind: "cancel" };

function emit(message: CelebrateMessage) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CelebrateMessage>(CELEBRATE_EVENT, { detail: message }));
}

export const startCelebration = (detail: CelebrateDetail) => emit({ kind: "start", detail });
export const finishCelebration = () => emit({ kind: "finish" });
export const cancelCelebration = () => emit({ kind: "cancel" });
