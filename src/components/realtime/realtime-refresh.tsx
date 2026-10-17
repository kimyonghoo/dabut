"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function RealtimeRefresh({ table }: { table: "events" | "transactions" }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const channel = supabase
      .channel(`refresh-${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => router.refresh(), 300);
      })
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [table, router]);

  return null;
}
