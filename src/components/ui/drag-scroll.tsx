"use client";

import type { ComponentPropsWithoutRef } from "react";

/**
 * Lets a horizontally scrollable row be dragged with a mouse (touch already
 * scrolls natively). A drag past a few pixels swallows the click that follows
 * so chips don't toggle by accident.
 */
export function dragScrollRef(el: HTMLElement | null) {
  if (!el || (el as HTMLElement & { _dragScroll?: boolean })._dragScroll) return;
  (el as HTMLElement & { _dragScroll?: boolean })._dragScroll = true;
  let down = false;
  let moved = false;
  let startX = 0;
  let startLeft = 0;

  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    down = true;
    moved = false;
    startX = e.clientX;
    startLeft = el.scrollLeft;
  });
  window.addEventListener("pointermove", (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4) moved = true;
    if (moved) el.scrollLeft = startLeft - dx;
  });
  const end = () => {
    down = false;
  };
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
  el.addEventListener(
    "click",
    (e) => {
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
        moved = false;
      }
    },
    true
  );
  el.addEventListener("dragstart", (e) => e.preventDefault());
}

export function DragScrollRow(props: ComponentPropsWithoutRef<"div">) {
  return <div {...props} ref={dragScrollRef} />;
}
