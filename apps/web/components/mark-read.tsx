"use client";

import { useEffect } from "react";

/**
 * Marks the item read once the reading view is actually on screen.
 *
 * Doing this in the server component would mean a GET with a side effect,
 * which a prefetch or a crawler would trigger without anyone reading
 * anything.
 */
export function MarkRead({ id, alreadyRead }: { id: string; alreadyRead: boolean }) {
  useEffect(() => {
    if (alreadyRead) return;
    void fetch(`/api/items/${id}/read`, { method: "POST" });
  }, [id, alreadyRead]);

  return null;
}
