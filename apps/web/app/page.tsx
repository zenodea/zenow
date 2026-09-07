import { Suspense } from "react";
import { listItemsQuerySchema } from "@zenow/shared";
import { Feed } from "@/components/feed";
import { ListControls } from "@/components/list-controls";
import { TagChip } from "@/components/tag-chip";
import { requireSession } from "@/lib/guard";
import { listItems, listTags } from "@/lib/items";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();

  const raw = await searchParams;
  const parsed = listItemsQuerySchema.safeParse({ ...raw, limit: 60 });
  const query = parsed.success ? parsed.data : { limit: 60 };

  const [{ items }, tags] = await Promise.all([listItems(query), listTags()]);

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-bold tracking-tight">
            Zenow<span className="text-accent">.</span>
          </span>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="text-xs text-muted hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <Suspense fallback={null}>
          <ListControls />
        </Suspense>

        {tags.length > 0 ? (
          <div className="mb-8 flex flex-wrap gap-1.5">
            {tags.map(({ tag, count }) => (
              <TagChip key={tag} tag={tag} count={count} active={query.tag === tag} />
            ))}
          </div>
        ) : null}

        {/* Remount on filter change so the feed does not merge two result sets. */}
        <Feed key={`${query.status ?? ""}:${query.q ?? ""}:${query.tag ?? ""}`} initial={items} />
      </main>
    </>
  );
}
