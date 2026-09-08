import { and, contents, desc, eq, inArray, items, jobs, lt, or, sql, summaries, type Item } from "@zenow/db";
import {
  canonicalizeUrl,
  detectSourceType,
  type ImagePick,
  type ImageRef,
  type ItemCard,
  type ItemDetail,
  type ListItemsQuery,
  type ListItemsResponse,
  type SavedFrom,
} from "@zenow/shared";
import { db } from "./db";

/**
 * tenantId is the first argument of every function here, and never optional.
 * Forgetting it is a compile error rather than a cross-tenant read.
 */

type CardRow = {
  item: Item;
  readTimeMin: number | null;
  keyPoints: string[] | null;
  imagePicks: ImagePick[] | null;
  contentImages: ImageRef[] | null;
};

const cardSelection = {
  item: items,
  readTimeMin: summaries.readTimeMin,
  keyPoints: summaries.keyPoints,
  imagePicks: summaries.imagePicks,
  contentImages: contents.images,
};

/** Keyset on (created_at, id) so a new save never shifts a page boundary. */
function encodeCursor(item: Item): string {
  return Buffer.from(`${item.createdAt.toISOString()}|${item.id}`).toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  if (!iso || !id) return null;
  const createdAt = new Date(iso);
  return Number.isNaN(createdAt.getTime()) ? null : { createdAt, id };
}

function thumbnailFor(picks: ImagePick[] | null, images: ImageRef[] | null): string | null {
  const available = images ?? [];
  const chosen = picks?.[0];
  if (chosen) {
    const match = available.find((image) => image.index === chosen.index);
    if (match) return match.url;
  }
  return available[0]?.url ?? null;
}

function toItemCard(row: CardRow): ItemCard {
  return {
    id: row.item.id,
    url: row.item.url,
    canonical_url: row.item.canonicalUrl,
    title: row.item.title,
    source_type: row.item.sourceType,
    status: row.item.status,
    error: row.item.error,
    saved_from: row.item.savedFrom,
    created_at: row.item.createdAt.toISOString(),
    updated_at: row.item.updatedAt.toISOString(),
    read_time_min: row.readTimeMin,
    lead: row.keyPoints?.[0] ?? null,
    thumbnail: thumbnailFor(row.imagePicks, row.contentImages),
    tags: row.item.tags,
  };
}

export async function listItems(tenantId: string, query: ListItemsQuery): Promise<ListItemsResponse> {
  const conditions = [eq(items.tenantId, tenantId)];

  if (query.status) conditions.push(eq(items.status, query.status));
  if (query.tag) conditions.push(sql`${items.tags} @> ARRAY[${query.tag}]::text[]`);

  // The `search` tsvector columns are added by migration 0001_search and are
  // deliberately absent from the drizzle schema: they are large, generated,
  // and nothing but this query ever reads them.
  if (query.q) {
    const match = sql`plainto_tsquery('english', ${query.q})`;
    const found = or(
      sql`items.search @@ ${match}`,
      sql`contents.search @@ ${match}`,
      sql`summaries.search @@ ${match}`,
    );
    if (found) conditions.push(found);
  }

  if (query.ids !== undefined) {
    const ids = query.ids.split(",").map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0) return { items: [], next_cursor: null };
    conditions.push(inArray(items.id, ids));
  }

  if (query.cursor) {
    const cursor = decodeCursor(query.cursor);
    if (cursor) {
      const page = or(
        lt(items.createdAt, cursor.createdAt),
        and(eq(items.createdAt, cursor.createdAt), lt(items.id, cursor.id)),
      );
      if (page) conditions.push(page);
    }
  }

  const rows = await db()
    .select(cardSelection)
    .from(items)
    .leftJoin(summaries, eq(summaries.itemId, items.id))
    .leftJoin(contents, eq(contents.itemId, items.id))
    .where(and(...conditions))
    .orderBy(desc(items.createdAt), desc(items.id))
    .limit(query.limit + 1);

  const page = rows.slice(0, query.limit);
  const last = page.at(-1);

  return {
    items: page.map(toItemCard),
    next_cursor: rows.length > query.limit && last ? encodeCursor(last.item) : null,
  };
}

export async function getItemDetail(tenantId: string, id: string): Promise<ItemDetail | null> {
  const [row] = await db()
    .select({ item: items, summary: summaries, content: contents })
    .from(items)
    .leftJoin(summaries, eq(summaries.itemId, items.id))
    .leftJoin(contents, eq(contents.itemId, items.id))
    .where(and(eq(items.tenantId, tenantId), eq(items.id, id)))
    .limit(1);

  if (!row) return null;

  const available = row.content?.images ?? [];
  const picked = (row.summary?.imagePicks ?? []).flatMap((pick) => {
    const image = available.find((candidate) => candidate.index === pick.index);
    return image ? [{ ...image, caption: pick.caption }] : [];
  });

  const card = toItemCard({
    item: row.item,
    readTimeMin: row.summary?.readTimeMin ?? null,
    keyPoints: row.summary?.keyPoints ?? null,
    imagePicks: row.summary?.imagePicks ?? null,
    contentImages: row.content?.images ?? null,
  });

  return {
    ...card,
    summary: row.summary
      ? {
          model: row.summary.model,
          summary_md: row.summary.summaryMd,
          key_points: row.summary.keyPoints,
          images: picked,
          tokens_in: row.summary.tokensIn,
          tokens_out: row.summary.tokensOut,
          created_at: row.summary.createdAt.toISOString(),
        }
      : null,
    content: row.content
      ? {
          text: row.content.text,
          html: row.content.html,
          images: row.content.images,
          meta: row.content.meta,
          fetched_at: row.content.fetchedAt.toISOString(),
        }
      : null,
  };
}

/** Insert and enqueue in one transaction so a saved item always has a job. */
export async function saveItem(
  tenantId: string,
  input: { url: string; savedFrom: SavedFrom },
): Promise<{ item: Item; created: boolean }> {
  const canonicalUrl = canonicalizeUrl(input.url);
  const sourceType = detectSourceType(input.url);

  return db().transaction(async (tx) => {
    const [inserted] = await tx
      .insert(items)
      .values({ tenantId, url: input.url.trim(), canonicalUrl, sourceType, savedFrom: input.savedFrom })
      .onConflictDoNothing({ target: [items.tenantId, items.canonicalUrl] })
      .returning();

    if (!inserted) {
      const [existing] = await tx
        .select()
        .from(items)
        .where(and(eq(items.tenantId, tenantId), eq(items.canonicalUrl, canonicalUrl)))
        .limit(1);
      if (!existing) throw new Error(`canonical_url ${canonicalUrl} conflicted but did not select`);
      return { item: existing, created: false };
    }

    await tx.insert(jobs).values({ tenantId, itemId: inserted.id, kind: "fetch" });
    return { item: inserted, created: true };
  });
}

export async function retryItem(tenantId: string, id: string): Promise<Item | null> {
  return db().transaction(async (tx) => {
    const [item] = await tx
      .update(items)
      .set({ status: "queued", error: null, updatedAt: new Date() })
      .where(and(eq(items.tenantId, tenantId), eq(items.id, id)))
      .returning();
    if (!item) return null;

    await tx.delete(jobs).where(and(eq(jobs.tenantId, tenantId), eq(jobs.itemId, id)));
    await tx.insert(jobs).values({ tenantId, itemId: id, kind: "fetch" });
    return item;
  });
}

export async function deleteItem(tenantId: string, id: string): Promise<boolean> {
  const deleted = await db()
    .delete(items)
    .where(and(eq(items.tenantId, tenantId), eq(items.id, id)))
    .returning({ id: items.id });
  return deleted.length > 0;
}

/** Tags in use by this tenant, most common first, for the filter bar. */
export async function listTags(tenantId: string, limit = 30): Promise<{ tag: string; count: number }[]> {
  return db()
    .select({ tag: sql<string>`tag`, count: sql<number>`count(*)::int` })
    .from(sql`items, unnest(items.tags) as tag`)
    .where(eq(items.tenantId, tenantId))
    .groupBy(sql`tag`)
    .orderBy(desc(sql`count(*)`), sql`tag`)
    .limit(limit);
}
