"use client";

import { useSyncExternalStore } from "react";

function subscribeMaxSm(cb: () => void) {
  const mq = window.matchMedia("(max-width: 639px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getMaxSmSnapshot() {
  return window.matchMedia("(max-width: 639px)").matches;
}

/** True when viewport is Tailwind `sm` breakpoint or below. */
export function useIsMaxSm() {
  return useSyncExternalStore(subscribeMaxSm, getMaxSmSnapshot, () => false);
}
