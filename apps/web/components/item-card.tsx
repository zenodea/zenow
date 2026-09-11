"use client";

import Link from "next/link";
import { useState } from "react";
import type { ItemCard as Item, SourceType } from "@zenow/shared";
import { StatusPill } from "./status-pill";
import { TagChip } from "./tag-chip";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const BADGES: Partial<Record<SourceType, string>> = { research: "Research", pdf: "PDF", digest: "Week" };

/** Only for the kinds you would not guess from the host. */
export function SourceBadge({ type }: { type: SourceType }) {
  const label = BADGES[type];
  if (!label) return null;

  return (
    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
      {label}
    </span>
  );
}

export function ItemCardRow({ item, onArchived }: { item: Item; onArchived?: (id: string) => void }) {
  const host = hostOf(item.url);
  const [busy, setBusy] = useState(false);

  async function toggleArchive() {
    setBusy(true);
    const response = await fetch(`/api/items/${item.id}/archive`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ archived: !item.archived }),
    });
    setBusy(false);
    if (response.ok) onArchived?.(item.id);
  }

  return (
    <article className="group">
      <Link href={`/items/${item.id}`} transitionTypes={["nav-in"]} className="block">
        <div className="relative mb-3 aspect-[16/9] overflow-hidden rounded-xl border border-line bg-surface">
          {item.thumbnail ? (
            // Arbitrary remote hosts, so no optimizer in the path.
            <img
              src={item.thumbnail}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <span className="font-serif text-3xl text-muted/50">{host.charAt(0).toUpperCase()}</span>
            </div>
          )}

          <div className="absolute top-2 right-2">
            <SourceBadge type={item.source_type} />
          </div>

          {item.status === "done" ? null : (
            <div className="absolute top-2 left-2">
              <span className="rounded-full bg-surface/90 p-0.5 backdrop-blur">
                <StatusPill status={item.status} />
              </span>
            </div>
          )}
        </div>

        <h2 className="mb-1.5 line-clamp-2 leading-snug font-semibold text-pretty group-hover:text-accent">
          {item.read ? null : (
            <span
              className="mr-1.5 inline-block size-1.5 -translate-y-0.5 rounded-full bg-accent"
              title="Unread"
            />
          )}
          {item.title ?? item.url}
        </h2>

        {item.error ? (
          // Red only when it has actually given up; while retrying this is
          // progress information, not a failure.
          <p className={`mb-2 line-clamp-2 text-sm ${item.status === "failed" ? "text-accent" : "text-muted italic"}`}>
            {item.status === "failed" ? item.error : `Retrying — ${item.error}`}
          </p>
        ) : item.lead ? (
          <p className="mb-2 line-clamp-2 text-sm text-muted">{item.lead}</p>
        ) : null}

      </Link>

      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] tracking-wide text-muted uppercase">
          {item.source_type === "research" || item.source_type === "digest" ? "Zenow" : host}
          {item.read_time_min ? ` · ${item.read_time_min} min` : ""}
        </p>

        {/* Shown on hover on a mouse, always on a touch screen, which has no
            hover to reveal it with. */}
        <button
          type="button"
          onClick={toggleArchive}
          disabled={busy}
          className="shrink-0 text-[11px] tracking-wide text-muted uppercase opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 hover:text-accent disabled:opacity-40 [@media(hover:none)]:opacity-100"
        >
          {item.archived ? "Restore" : "Archive"}
        </button>
      </div>

      {item.tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {item.tags.map((tag) => (
            <TagChip key={tag} tag={tag} />
          ))}
        </div>
      ) : null}
    </article>
  );
}
