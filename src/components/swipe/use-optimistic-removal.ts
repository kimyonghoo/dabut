"use client";

import { useCallback, useState } from "react";
import { showToast } from "@/components/feedback/toast-bus";

/**
 * Hides an item immediately, runs the delete, and restores it (with an error
 * toast) if the delete fails. On success shows `successToast`.
 */
export function useOptimisticRemoval(
  deleteFn: (id: string) => Promise<{ ok: boolean }>,
  successToast: string
) {
  const [removed, setRemoved] = useState<ReadonlySet<string>>(() => new Set());

  const remove = useCallback(
    async (id: string) => {
      setRemoved((prev) => new Set(prev).add(id));
      const result = await deleteFn(id).catch(() => ({ ok: false }));
      if (result.ok) {
        showToast(successToast);
        return;
      }
      setRemoved((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      showToast("deleteFailed", "error");
    },
    [deleteFn, successToast]
  );

  const isRemoved = useCallback((id: string) => removed.has(id), [removed]);

  return { remove, isRemoved };
}
