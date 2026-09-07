"use client";

import { useCallback, useEffect, useState } from "react";
import type { ItemCard } from "@zenow/shared";
import { ItemCardRow } from "./item-card";
import { SaveForm } from "./save-form";

const POLL_MS = 3000;

function isPending(item: ItemCard): boolean {
  return item.status !== "done" && item.status !== "failed";
}

export function Feed({ initial }: { initial: ItemCard[] }) {
  const [items, setItems] = useState(initial);

  const pendingKey = items.filter(isPending).map((item) => item.id).join(",");

  const merge = useCallback((incoming: ItemCard[]) => {
    setItems((current) => {
      const byId = new Map(current.map((item) => [item.id, item]));
      for (const item of incoming) byId.set(item.id, item);
      return [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
    });
  }, []);

  // Only polls while something is still working, and only for those ids.
  useEffect(() => {
    if (!pendingKey) return;

    const timer = setInterval(async () => {
      const response = await fetch(`/api/items?ids=${pendingKey}`);
      if (!response.ok) return;
      const body = await response.json();
      merge(body.items ?? []);
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [pendingKey, merge]);

  return (
    <>
      <div className="mb-10">
        <SaveForm onSaved={(item) => merge([item])} />
      </div>

      {items.length === 0 ? (
        <p className="py-24 text-center text-sm text-muted">
          Nothing saved yet. Paste a link above to get started.
        </p>
      ) : (
        <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ItemCardRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </>
  );
}
