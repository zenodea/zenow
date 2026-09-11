import { Suspense } from "react";
import { listItemsQuerySchema } from "@zenow/shared";
import { Feed } from "@/components/feed";
import { Header } from "@/components/header";
import type { FeedView } from "@/components/toolbar";
import { PageTransition } from "@/components/page-transition";
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

  const home = raw.view !== "all" && !query.unread && !query.archived && !query.status && !query.q && !query.tag;

  const [first, tags] = await Promise.all([
    listItems(tenantId, home ? { ...query, unread: true } : query),
    listTags(tenantId),
  ]);
  const fellBack = home && first.items.length === 0;
  const { items } = fellBack ? await listItems(tenantId, query) : first;
  const view: FeedView = query.archived ? "archive" : query.unread || (home && !fellBack) ? "unread" : "all";

  return (
    <>
      <Header />

      <PageTransition>
      <main className="mx-auto max-w-5xl px-6 sm:pr-9 pt-6 pb-10">
        {/* Remount on filter change so the feed does not merge two result sets. */}
        <Suspense fallback={null}>
          <Feed
            key={`${view}:${query.status ?? ""}:${query.q ?? ""}:${query.tag ?? ""}`}
            initial={items}
            tags={tags}
            view={view}
            filtered={Boolean(query.q || query.tag || query.status || query.unread || query.archived)}
          />
        </Suspense>
      </main>
      </PageTransition>
    </>
  );
}
