import { Suspense } from "react";
import { listItemsQuerySchema } from "@zenow/shared";
import { Feed } from "@/components/feed";
import { Header } from "@/components/header";
import { PageTransition } from "@/components/page-transition";
import { ListControls } from "@/components/list-controls";
import { TagChip } from "@/components/tag-chip";
import { requireTenant } from "@/lib/guard";
import { listItems, listTags } from "@/lib/items";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantId } = await requireTenant();

  const raw = await searchParams;
  const parsed = listItemsQuerySchema.safeParse({ ...raw, limit: 60 });
  const query = parsed.success ? parsed.data : { limit: 60 };

  const [{ items }, tags] = await Promise.all([listItems(tenantId, query), listTags(tenantId)]);

  return (
    <>
      <Header />

      <PageTransition>
      <main className="mx-auto max-w-5xl px-6 py-10">
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
        <Feed key={`${query.status ?? ""}:${query.q ?? ""}:${query.tag ?? ""}:${query.unread ?? ""}`} initial={items} />
      </main>
      </PageTransition>
    </>
  );
}
