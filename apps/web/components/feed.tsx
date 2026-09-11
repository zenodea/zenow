"use client";

import { useCallback, useEffect, useState } from "react";
import type { ItemCard } from "@zenow/shared";
import { ItemCardRow } from "./item-card";
import { SaveForm } from "./save-form";
import { Toolbar, type FeedView } from "./toolbar";

const POLL_MS = 3000;

function isPending(item: ItemCard): boolean {
  return item.status !== "done" && item.status !== "failed";
}

export function Feed({
  initial,
  tags,
  view,
  filtered,
}: {
  initial: ItemCard[];
  tags: { tag: string; count: number }[];
  view: FeedView;
  /** Whether the emptiness could be the filter's doing rather than the list's. */
  filtered: boolean;
}) {
  const [items, setItems] = useState(initial);
  // Open for someone with nothing saved, because there is nothing else for
  // them to do; closed once the list is the point of the page, and closed for
  // a search that found nothing -- they were not trying to save anything.
  const [composing, setComposing] = useState(initial.length === 0 && !filtered);

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
      <Toolbar tags={tags} view={view} composing={composing} onCompose={() => setComposing((open) => !open)} />

      {composing ? (
        <div className="mb-6 rounded-xl border border-line bg-surface p-4">
          <SaveForm
            onSaved={(item) => {
              merge([item]);
              setComposing(false);
            }}
          />
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="py-20 text-center text-sm text-muted">
          {filtered ? "Nothing matches that." : composing ? "Paste a link above to get started." : "Nothing here."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 sm:gap-y-10 lg:grid-cols-3">
          {items.map((item) => (
            <ItemCardRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </>
  );
}
