import Link from "next/link";
import type { ItemCard as Item } from "@zenow/shared";
import { StatusPill } from "./status-pill";
import { TagChip } from "./tag-chip";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function ItemCardRow({ item }: { item: Item }) {
  const host = hostOf(item.url);

  return (
    <article className="group">
      <Link href={`/items/${item.id}`} className="block">
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

          {item.status === "done" ? null : (
            <div className="absolute top-2 left-2">
              <span className="rounded-full bg-surface/90 p-0.5 backdrop-blur">
                <StatusPill status={item.status} />
              </span>
            </div>
          )}
        </div>

        <h2 className="mb-1.5 line-clamp-2 leading-snug font-semibold text-pretty group-hover:text-accent">
          {item.title ?? item.url}
        </h2>

        {item.error ? (
          <p className="mb-2 line-clamp-2 text-sm text-accent">{item.error}</p>
        ) : item.lead ? (
          <p className="mb-2 line-clamp-2 text-sm text-muted">{item.lead}</p>
        ) : null}

        <p className="text-[11px] tracking-wide text-muted uppercase">
          {host}
          {item.read_time_min ? ` · ${item.read_time_min} min` : ""}
        </p>
      </Link>

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
