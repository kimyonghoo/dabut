"use client";

import { useMemo } from "react";
import { useRouter } from "@/i18n/navigation";
import { startProgress } from "./progress-store";

/** Locale-aware router whose push/replace also start the top progress bar. */
export function useProgressRouter() {
  const router = useRouter();
  return useMemo(
    () => ({
      ...router,
      push: ((...args: Parameters<typeof router.push>) => {
        startProgress();
        router.push(...args);
      }) as typeof router.push,
      replace: ((...args: Parameters<typeof router.replace>) => {
        startProgress();
        router.replace(...args);
      }) as typeof router.replace,
    }),
    [router]
  );
}
