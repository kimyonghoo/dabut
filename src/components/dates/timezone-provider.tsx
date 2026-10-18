"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { DEFAULT_TIMEZONE } from "@/lib/dates/timezone";

type TimezoneContextValue = {
  timeZone: string;
  setTimeZone: (timeZone: string) => void;
};

const TimezoneContext = createContext<TimezoneContextValue | null>(null);

/**
 * Mirrors BrandColorProvider: seeds from the server-fetched `profiles.timezone`
 * so SSR and hydration agree, then lets client components (settings, the
 * event form, the day summary sheet) read and update it without a reload.
 */
export function TimezoneProvider({
  initialTimeZone,
  children,
}: {
  initialTimeZone: string;
  children: ReactNode;
}) {
  const [timeZone, setTimeZone] = useState(initialTimeZone || DEFAULT_TIMEZONE);

  return <TimezoneContext.Provider value={{ timeZone, setTimeZone }}>{children}</TimezoneContext.Provider>;
}

export function useTimezone(): TimezoneContextValue {
  const ctx = useContext(TimezoneContext);
  if (!ctx) throw new Error("useTimezone must be used within a TimezoneProvider");
  return ctx;
}
