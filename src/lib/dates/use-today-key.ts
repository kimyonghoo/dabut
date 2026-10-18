"use client";

import { useEffect, useState } from "react";
import { toDateKey } from "./relative-day";

/**
 * Today's `yyyy-MM-dd` in the viewer's time zone. Starts from the server's
 * value (so SSR and hydration agree) and switches to the device's local date
 * after mount, which matters when the server runs in UTC.
 */
export function useTodayKey(serverTodayKey: string): string {
  const [todayKey, setTodayKey] = useState(serverTodayKey);
  useEffect(() => {
    setTodayKey(toDateKey(new Date()));
  }, []);
  return todayKey;
}
