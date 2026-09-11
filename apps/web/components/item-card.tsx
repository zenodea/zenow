import Link from "next/link";
import type { ItemCard as Item, SourceType } from "@zenow/shared";
import { StatusPill } from "./status-pill";
import { TagChip } from "./tag-chip";

const BADGES: Partial<Record<SourceType, string>> = { research: "Research", pdf: "PDF", digest: "Week" };

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Only for the kinds you would not guess from the host. */
export function SourceBadge({ type }: { type: SourceType }) {
  const label = BADGES[type];
  if (!label) return null;

  return (
    <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-white uppercase">
      {label}
    </span>
  );
}

/**
 * A row on a phone and a card on anything wider. The same markup either way,
 * because the difference is only how much room the picture deserves: on a
 * phone a 16:9 thumbnail meant one article per screen, which is a poor way to
 * show someone a reading list.
 */
export function ItemCardRow({ item }: { item: Item }) {
  const host = hostOf(item.url);

  return (
    <article className="group">
      <Link href={`/items/${item.id}`} transitionTypes={["nav-in"]} className="flex gap-3 sm:block">
        {/* 16:9 on a phone too, not a square. Most thumbnails are og:image
            banners, and cropping a 1200x630 to a square keeps the middle --
            usually the one part with nothing in it, which reads as no picture
            at all rather than a small one. */}
        <div className="aspect-[16/9] w-28 shrink-0 overflow-hidden rounded-lg border border-line bg-surface sm:mb-3 sm:w-full sm:rounded-xl">
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
              <span className="font-serif text-xl text-muted/50 sm:text-3xl">
                {host.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-1.5">
            {item.read ? null : (
              <span className="size-1.5 shrink-0 rounded-full bg-accent" title="Unread" />
            )}
            <span className="truncate text-[11px] tracking-wide text-muted uppercase">
              {item.source_type === "research" || item.source_type === "digest" ? "Zenow" : host}
              {item.read_time_min ? ` · ${item.read_time_min} min` : ""}
            </span>
            <SourceBadge type={item.source_type} />
            {item.status === "done" ? null : <StatusPill status={item.status} />}
          </div>

          <h2 className="line-clamp-2 leading-snug font-semibold text-pretty wrap-break-word group-hover:text-accent">
            {item.title ?? item.url}
          </h2>

          {item.error ? (
            // Red only when it has actually given up; while retrying this is
            // progress information, not a failure.
            <p
              className={`mt-1 line-clamp-2 text-sm wrap-break-word ${item.status === "failed" ? "text-accent" : "text-muted italic"}`}
            >
              {item.status === "failed" ? item.error : `Retrying — ${item.error}`}
            </p>
          ) : item.lead ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted wrap-break-word">{item.lead}</p>
          ) : null}
        </div>
      </Link>

      {item.tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {item.tags.slice(0, 2).map((tag) => (
            <TagChip key={tag} tag={tag} />
          ))}
        </div>
      ) : null}

    </article>
  );
}
