"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ItemStatus } from "@zenow/shared";

const POLL_MS = 3000;

/**
 * Keeps the reading view up to date while the item is still being worked on.
 *
 * Without this the page was a snapshot: pressing Re-read, or starting a piece
 * of research, changed the database and nothing on screen, so the button
 * looked broken and research looked like it queued forever. The list already
 * polled; this is the same idea for one item.
 */
export function LiveItem({ id, status }: { id: string; status: ItemStatus }) {
  const router = useRouter();
  const settled = status === "done" || status === "failed";

  useEffect(() => {
    if (settled) return;

    const timer = setInterval(async () => {
      const response = await fetch(`/api/items?ids=${id}`);
      if (!response.ok) return;
      const body = await response.json();
      const next = body.items?.[0]?.status as ItemStatus | undefined;
      if (next && next !== status) router.refresh();
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [id, status, settled, router]);

  return null;
}
